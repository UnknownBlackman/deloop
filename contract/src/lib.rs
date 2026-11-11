//! Deloop: on-chain registry of confirmed inter-business debts.
//! Loops of confirmed debts are cleared without moving NEAR (`clear_cycle`);
//! only the leftover is paid in native NEAR (`pay_debt`).
//!
//! "debtor owes creditor". All amounts are yoctoNEAR.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::Vector;
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Proposed,
    Confirmed,
    Settled,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Debt {
    pub id: u64,
    pub debtor: AccountId,
    pub creditor: AccountId,
    pub amount: U128,
    pub outstanding: U128,
    pub invoice_ref: String,
    pub status: Status,
}

#[near(serializers = [json])]
#[derive(Debug, PartialEq, Eq)]
pub struct Totals {
    /// Sum of `outstanding` over Confirmed debts.
    pub outstanding_sum: U128,
    /// Number of Confirmed debts with outstanding > 0.
    pub count: u64,
}

#[near(contract_state)]
pub struct Deloop {
    /// Index in the vector == debt id.
    debts: Vector<Debt>,
}

impl Default for Deloop {
    fn default() -> Self {
        Self { debts: Vector::new(b"d") }
    }
}

fn emit(event: &str, data: near_sdk::serde_json::Value) {
    let log = json!({
        "standard": "deloop",
        "version": "1.0.0",
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{log}"));
}

impl Deloop {
    fn debt_mut(&mut self, id: u64) -> &mut Debt {
        let idx = u32::try_from(id).unwrap_or_else(|_| env::panic_str("Unknown debt id"));
        self.debts
            .get_mut(idx)
            .unwrap_or_else(|| env::panic_str("Unknown debt id"))
    }
}

#[near]
impl Deloop {
    /// Caller is the creditor. Returns the new debt id.
    pub fn propose_debt(&mut self, debtor: AccountId, amount: U128, invoice_ref: String) -> u64 {
        let creditor = env::predecessor_account_id();
        require!(debtor != creditor, "Debtor and creditor must differ");
        require!(amount.0 > 0, "Amount must be > 0");
        require!(!invoice_ref.is_empty(), "invoice_ref required");
        let id = self.debts.len() as u64;
        self.debts.push(Debt {
            id,
            debtor,
            creditor,
            amount,
            outstanding: amount,
            invoice_ref,
            status: Status::Proposed,
        });
        id
    }

    /// Caller must be the debtor. Proposed -> Confirmed.
    pub fn confirm_debt(&mut self, id: u64) {
        let caller = env::predecessor_account_id();
        let debt = self.debt_mut(id);
        require!(debt.debtor == caller, "Only the debtor can confirm");
        require!(debt.status == Status::Proposed, "Debt is not Proposed");
        debt.status = Status::Confirmed;
    }

    /// Anyone may call. Subtracts `amount` from every debt in the cycle. No NEAR moves.
    pub fn clear_cycle(&mut self, debt_ids: Vec<u64>, amount: U128) {
        let n = debt_ids.len();
        require!(n >= 2, "A cycle needs at least 2 debts");
        require!(amount.0 > 0, "Amount must be > 0");
        for i in 0..n {
            for j in (i + 1)..n {
                require!(debt_ids[i] != debt_ids[j], "Debt id repeated");
            }
        }

        let mut debts: Vec<Debt> = Vec::with_capacity(n);
        for &id in &debt_ids {
            let d = self.debt_mut(id).clone();
            require!(d.status == Status::Confirmed, "Every debt must be Confirmed");
            require!(d.outstanding.0 >= amount.0, "Amount exceeds outstanding");
            debts.push(d);
        }
        for i in 0..n {
            let next = &debts[(i + 1) % n];
            require!(debts[i].creditor == next.debtor, "Debts do not form a cycle");
        }

        for &id in &debt_ids {
            let d = self.debt_mut(id);
            d.outstanding = U128(d.outstanding.0 - amount.0);
            if d.outstanding.0 == 0 {
                d.status = Status::Settled;
            }
        }

        let ring: Vec<String> = debts.iter().map(|d| d.debtor.to_string()).collect();
        emit(
            "cycle_cleared",
            json!({ "debt_ids": debt_ids, "amount": amount, "ring": ring }),
        );
    }

    /// Caller must be the debtor. Attached NEAR goes to the creditor.
    #[payable]
    pub fn pay_debt(&mut self, id: u64) -> Promise {
        let caller = env::predecessor_account_id();
        let deposit = env::attached_deposit().as_yoctonear();
        let debt = self.debt_mut(id);
        require!(debt.debtor == caller, "Only the debtor can pay");
        require!(debt.status == Status::Confirmed, "Debt is not Confirmed");
        require!(deposit > 0, "Attach a deposit > 0");
        require!(deposit <= debt.outstanding.0, "Deposit exceeds outstanding");

        debt.outstanding = U128(debt.outstanding.0 - deposit);
        if debt.outstanding.0 == 0 {
            debt.status = Status::Settled;
        }
        let creditor = debt.creditor.clone();
        let remaining = debt.outstanding;

        emit(
            "debt_paid",
            json!({ "id": id, "debtor": caller, "creditor": creditor,
                    "amount": U128(deposit), "outstanding": remaining }),
        );
        Promise::new(creditor).transfer(NearToken::from_yoctonear(deposit))
    }

    pub fn get_debts(&self) -> Vec<Debt> {
        self.debts.iter().cloned().collect()
    }

    pub fn get_debt(&self, id: u64) -> Option<Debt> {
        u32::try_from(id).ok().and_then(|i| self.debts.get(i).cloned())
    }

    pub fn get_totals(&self) -> Totals {
        let mut sum: u128 = 0;
        let mut count: u64 = 0;
        for d in self.debts.iter() {
            if d.status == Status::Confirmed && d.outstanding.0 > 0 {
                sum += d.outstanding.0;
                count += 1;
            }
        }
        Totals { outstanding_sum: U128(sum), count }
    }
}

#[cfg(test)]
mod tests;

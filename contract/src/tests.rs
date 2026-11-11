//! Fast unit tests mirroring the 5 sandbox tests (tests/contract.sandbox.test.ts).
//! The sandbox tests are the source of truth for real NEAR transfers.
use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

const NEAR: u128 = 10u128.pow(24);

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn as_caller(who: &str, deposit: u128) {
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(acc(who))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .build());
}

/// creditor proposes, debtor confirms.
fn confirmed(c: &mut Deloop, debtor: &str, creditor: &str, near: u128, r: &str) -> u64 {
    as_caller(creditor, 0);
    let id = c.propose_debt(acc(debtor), U128(near * NEAR), r.into());
    as_caller(debtor, 0);
    c.confirm_debt(id);
    id
}

/// a owes b, b owes c, c owes a — 10 NEAR each.
fn ring() -> (Deloop, Vec<u64>) {
    let mut c = Deloop::default();
    let ids = vec![
        confirmed(&mut c, "a.test", "b.test", 10, "R1"),
        confirmed(&mut c, "b.test", "c.test", 10, "R2"),
        confirmed(&mut c, "c.test", "a.test", 10, "R3"),
    ];
    (c, ids)
}

// 1. Only the debtor can confirm.
#[test]
#[should_panic(expected = "Only the debtor can confirm")]
fn t1_creditor_cannot_confirm() {
    let mut c = Deloop::default();
    as_caller("b.test", 0);
    let id = c.propose_debt(acc("a.test"), U128(NEAR), "X".into());
    c.confirm_debt(id);
}

#[test]
fn t1_debtor_confirms() {
    let mut c = Deloop::default();
    let id = confirmed(&mut c, "a.test", "b.test", 1, "X");
    assert_eq!(c.get_debt(id).unwrap().status, Status::Confirmed);
}

// 2. clear_cycle rejects a non-cycle, an unconfirmed debt, and amount > outstanding.
#[test]
#[should_panic(expected = "Debts do not form a cycle")]
fn t2_rejects_non_cycle() {
    let mut c = Deloop::default();
    let d1 = confirmed(&mut c, "a.test", "b.test", 10, "R1");
    let d2 = confirmed(&mut c, "b.test", "c.test", 10, "R2");
    c.clear_cycle(vec![d1, d2], U128(NEAR));
}

#[test]
#[should_panic(expected = "Every debt must be Confirmed")]
fn t2_rejects_unconfirmed() {
    let mut c = Deloop::default();
    let d1 = confirmed(&mut c, "a.test", "b.test", 10, "R1");
    as_caller("a.test", 0);
    let d2 = c.propose_debt(acc("b.test"), U128(10 * NEAR), "R2".into());
    c.clear_cycle(vec![d1, d2], U128(NEAR));
}

#[test]
#[should_panic(expected = "Amount exceeds outstanding")]
fn t2_rejects_amount_over_outstanding() {
    let (mut c, ids) = ring();
    c.clear_cycle(ids, U128(11 * NEAR));
}

#[test]
#[should_panic(expected = "Debt id repeated")]
fn t2_rejects_repeated_id() {
    let (mut c, ids) = ring();
    c.clear_cycle(vec![ids[0], ids[1], ids[2], ids[0]], U128(NEAR));
}

// 3. A 3-debt cycle clears and each outstanding drops by the amount.
#[test]
fn t3_three_cycle_clears() {
    let (mut c, ids) = ring();
    as_caller("anyone.test", 0);
    c.clear_cycle(ids.clone(), U128(4 * NEAR));
    for id in &ids {
        let d = c.get_debt(*id).unwrap();
        assert_eq!(d.outstanding.0, 6 * NEAR);
        assert_eq!(d.status, Status::Confirmed);
    }
    assert!(get_logs()[0].contains("\"event\":\"cycle_cleared\""));
    c.clear_cycle(ids.clone(), U128(6 * NEAR));
    for id in &ids {
        assert_eq!(c.get_debt(*id).unwrap().status, Status::Settled);
    }
    assert_eq!(c.get_totals().outstanding_sum.0, 0);
}

// 4. pay_debt reduces outstanding (balance check lives in the sandbox test).
#[test]
fn t4_pay_reduces_outstanding() {
    let mut c = Deloop::default();
    let id = confirmed(&mut c, "a.test", "b.test", 10, "R1");
    as_caller("a.test", 3 * NEAR);
    c.pay_debt(id);
    assert_eq!(c.get_debt(id).unwrap().outstanding.0, 7 * NEAR);
    assert!(get_logs()[0].contains("\"event\":\"debt_paid\""));
}

// 5. pay_debt rejects a deposit larger than outstanding and a non-debtor caller.
#[test]
#[should_panic(expected = "Deposit exceeds outstanding")]
fn t5_rejects_overpay() {
    let mut c = Deloop::default();
    let id = confirmed(&mut c, "a.test", "b.test", 10, "R1");
    as_caller("a.test", 11 * NEAR);
    c.pay_debt(id);
}

#[test]
#[should_panic(expected = "Only the debtor can pay")]
fn t5_rejects_non_debtor() {
    let mut c = Deloop::default();
    let id = confirmed(&mut c, "a.test", "b.test", 10, "R1");
    as_caller("b.test", NEAR);
    c.pay_debt(id);
}

#[test]
fn totals_count_confirmed_only() {
    let (mut c, _) = ring();
    as_caller("b.test", 0);
    c.propose_debt(acc("a.test"), U128(NEAR), "P".into());
    let t = c.get_totals();
    assert_eq!(t.outstanding_sum.0, 30 * NEAR);
    assert_eq!(t.count, 3);
}

I treated refund_id as the identity of a refund and use its events to derive its state.
If a refund has a refund.succeeded event, I consider it refunded. If it has no success but has a failure, I consider it failed. Otherwise, a request is considered pending.
I deduplicated using event_id.If the same event_id appears more than once, I process it only once.
I treated negative amounts as malformed data and did not included in financial totals.Because we cant reduce amount which is already refunded.
i also kept seperate crrencies for refunds, didnt treat INR and USD as same or convert it.
i flagged cases where actual successful refunds exceed the order total and displayed it by how much amount is it over refunded or requesting extra.
I kept chargeback as a seperate case and didnt include in calculating refund or pendind amt.
i used 2026-08-11T10:00:00+05:30 as now time to calculate past 7 days refunds.
i converted legacy gateway posts to hyd local time zone.
i kept approval as a console decision, not a payment event.
A refund can have only one recorded decision.The database has a unique constraint on refundId, and the API also checks for an existing decision. so double clicls are not allowed
i kept a threshold limit and displayed orders above it as high value.

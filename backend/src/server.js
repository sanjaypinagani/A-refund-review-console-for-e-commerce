
const cors = require("cors");


const express = require("express");
const path = require("path");

const connectDB = require("./db");
const Decision = require("./models/Decision");
const NOW = new Date("2026-08-11T10:00:00+05:30");
const {
    loadOrders,
    loadEvents,
    deduplicateEvents,
    groupEventsByRefund,
    getRefundStatus,
    getRefundAmount,
    calculateOrderState
} = require("./data");


const app = express();

app.use(express.json());
app.use(cors());
const decisions = [];
const ordersFile = path.join(
    __dirname,
    "../data/orders.csv"
);

const eventsFile = path.join(
    __dirname,
    "../data/events.jsonl"
);


async function startServer() {

    try {
      await connectDB();

        const orders = await loadOrders(ordersFile);

        const events = loadEvents(eventsFile);

        console.log("Orders:", orders.length);
        console.log("Events:", events.length);


        const uniqueEvents = deduplicateEvents(events);

        console.log(
            "Events after deduplication:",
            uniqueEvents.length
        );


        const refunds = groupEventsByRefund(uniqueEvents);


      const refundList = [];
      const SEVEN_DAYS_AGO = new Date(
    NOW.getTime() - 7 * 24 * 60 * 60 * 1000
);

for (const [refundId, refundEvents] of Object.entries(refunds)) {

    const status = getRefundStatus(refundEvents);
    const amount = getRefundAmount(refundEvents);


const issues = [];

if (amount === null) {
    issues.push({
        type: "missing_amount"
    });
}

if (amount !== null && amount < 0) {
    issues.push({
        type: "negative_amount",
        amount
    });
}
const requestedEvent = refundEvents.find(
    event => event.type === "refund.requested"
);
refundList.push({
    refundId,
    orderId: refundEvents[0].order_id,
    status,
    amount,
    currency: refundEvents[0].currency,
    requestedAt: requestedEvent
        ? requestedEvent.occurred_at
        : null,
    issues
});
}
const result = calculateOrderState(
    orders,
    refundList,
    events
);

const orderStates = result.orders;
const orphanRefunds = result.orphanRefunds;
console.log(orderStates.slice(0, 5));
app.get("/api/orders", (req, res) => {
            res.json(orderStates);
        });
app.get("/api/issues/orphan-refunds", (req, res) => {
    res.json(orphanRefunds);
});
app.get("/api/orders/:orderId", (req, res) => {
    const order = orderStates.find(
        order => order.orderId === req.params.orderId
    );

    if (!order) {
        return res.status(404).json({
            error: "Order not found"
        });
    }

    res.json(order);
});
app.get("/api/summary", (req, res) => {
    const pendingPayout = {};

    for (const order of orderStates) {
        if (order.pendingAmount === 0) {
            continue;
        }

        if (!pendingPayout[order.currency]) {
            pendingPayout[order.currency] = 0;
        }

        pendingPayout[order.currency] += order.pendingAmount;
    }

    res.json({
        pendingPayout,
        orderCount: orderStates.length
    });
});
app.get("/api/refunds/queue", (req, res) => {

    const queue = [];

    for (const order of orderStates) {

        for (const refund of order.refunds) {

            // Only refunds raised in the last 7 days
            if (!refund.requestedAt) {
                continue;
            }

            const requestedAt = new Date(
                refund.requestedAt
            );

            if (
                requestedAt < SEVEN_DAYS_AGO ||
                requestedAt > NOW
            ) {
                continue;
            }

            // Only money that can still move
            if (refund.status !== "pending") {
                continue;
            }

            queue.push({
                refundId: refund.refundId,
                orderId: order.orderId,
                customerId: order.customerId,
                currency: order.currency,
                amount: refund.amount,
                status: order.status,
                requestedAt: refund.requestedAt,
                remainingAmount: order.remainingAmount,
                overRequestedAmount: order.overRequestedAmount
            });
        }
    }

    res.json(queue);
});

app.get("/api/refunds/recent", async(req, res) => {

    const recentRefunds = [];

    for (const order of orderStates) {

        for (const refund of order.refunds) {

            if (!refund.requestedAt) {
                continue;
            }

            const requestedAt = new Date(
                refund.requestedAt
            );

            if (
                requestedAt < SEVEN_DAYS_AGO ||
                requestedAt > NOW
            ) {
                continue;
            }
            const decision = await Decision.findOne({
                    refundId: refund.refundId
                });

            recentRefunds.push({
                refundId: refund.refundId,
                orderId: order.orderId,
                customerId: order.customerId,
                currency: refund.currency,
                amount: refund.amount,
                status: refund.status,
                isHighValue: order.isHighValue,
                decision: decision
        ? decision.decision
        : null,
                requestedAt: refund.requestedAt,
                decisionReason: decision
                        ? decision.reason
                        : null
            });
        }
    }

    res.json(recentRefunds);
});


app.post("/api/refunds/:refundId/decision", async (req, res) => {

    try {

        const refundId = req.params.refundId;

        const {
            decision,
            reason
        } = req.body;


        if (
            decision !== "approved" &&
            decision !== "rejected"
        ) {
            return res.status(400).json({
                error:
                    "Decision must be approved or rejected"
            });
        }


        if (
            !reason ||
            !reason.trim()
        ) {
            return res.status(400).json({
                error:
                    "Reason is required"
            });
        }


        const refund =
            refundList.find(
                refund =>
                    refund.refundId === refundId
            );


        if (!refund) {
            return res.status(404).json({
                error:
                    "Refund not found"
            });
        }


        const existingDecision =
            await Decision.findOne({
                refundId
            });


        if (existingDecision) {
            return res.status(409).json({
                error:
                    "A decision has already been recorded"
            });
        }


        const newDecision =
            await Decision.create({

                refundId,

                decision,

                reason:
                    reason.trim()

            });


        res.status(201).json(
            newDecision
        );


    } catch (error) {

        console.error(
            "Failed to save decision:",
            error
        );


        res.status(500).json({
            error:
                "Failed to save decision"
        });

    }

});
app.get("/api/refunds/:refundId/decision", async (req, res) => {
    try {
        const refundId = req.params.refundId;

        const decision = await Decision.findOne({
            refundId
        });

        if (!decision) {
            return res.json({
                decided: false
            });
        }

        res.json({
            decided: true,
            decision
        });

    } catch (error) {

        console.error(
            "Failed to load decision:",
            error
        );

        res.status(500).json({
            error: "Failed to load decision"
        });
    }
});
        app.listen(3000, () => {
            console.log(
                "Server running on http://localhost:3000"
            );
        });

    } catch (error) {

        console.error(
            "Failed to load data:",
            error
        );

    }
}


app.get("/", (req, res) => {
    res.send("Refund Review Console Backend is running");
});


startServer();
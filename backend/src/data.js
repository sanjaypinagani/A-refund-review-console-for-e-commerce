const fs = require("fs");
const csv = require("csv-parser");


// Load orders.csv
function loadOrders(filePath) {
    return new Promise((resolve, reject) => {
        const orders = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (row) => {
                orders.push(row);
            })
            .on("end", () => {
                resolve(orders);
            })
            .on("error", (error) => {
                reject(error);
            });
    });
}


// Load events.jsonl
function loadEvents(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");

    const events = content
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => JSON.parse(line));

    return events;
}


// Remove duplicate events
function deduplicateEvents(events) {
    const seen = new Set();
    const uniqueEvents = [];

    for (const event of events) {
        const eventId = event.event_id;

        if (!eventId) {
            uniqueEvents.push(event);
            continue;
        }

        if (seen.has(eventId)) {
            continue;
        }

        seen.add(eventId);
        uniqueEvents.push(event);
    }

    return uniqueEvents;
}


// Group refund events by refund_id
function groupEventsByRefund(events) {
    const refunds = {};

    for (const event of events) {
        const refundId = event.refund_id;

        if (!refundId) {
            continue;
        }

        if (!refunds[refundId]) {
            refunds[refundId] = [];
        }

        refunds[refundId].push(event);
    }

    return refunds;
}

function getRefundStatus(events) {
    let hasRequested = false;
    let hasSucceeded = false;
    let hasFailed = false;

    for (const event of events) {
        if (event.type === "refund.requested") {
            hasRequested = true;
        }

        if (event.type === "refund.succeeded") {
            hasSucceeded = true;
        }

        if (event.type === "refund.failed") {
            hasFailed = true;
        }
    }

    if (hasSucceeded) {
        return "refunded";
    }

    if (hasFailed) {
        return "failed";
    }

    if (hasRequested) {
        return "pending";
    }

    return "unknown";
}

function getRefundAmount(events) {
    for (const event of events) {
        if (event.amount_minor !== undefined) {
            return Number(event.amount_minor);
        }

        if (event.amount !== undefined) {
            return Math.round(Number(event.amount) * 100);
        }
    }

    return null;
}

function calculateOrderState(orders, refundList,events) {
    const orderIds = new Set(
    orders.map(order => order.order_id)
    );

    const orphanRefunds = refundList.filter(
    refund => !orderIds.has(refund.orderId)
    );
    const orderStates = [];

    for (const order of orders) {
        let hasChargeback = false;
        const orderRefunds = refundList.filter(
            refund => refund.orderId === order.order_id
        );

        const totalAmount =
            Math.round(Number(order.total_amount) * 100);

        let refundedAmount = 0;
        let pendingAmount = 0;
        const issues = [];
        const chargeback = events.some(
    event =>
        event.order_id === order.order_id &&
        event.type === "chargeback.opened"
);

if (chargeback) {
    hasChargeback = true;
}
        
        

        for (const refund of orderRefunds) {

            if (
                refund.issues &&
                refund.issues.some(issue => issue.type === "negative_amount")
            ) {
            issues.push({
        type: "negative_amount",
        refundId: refund.refundId
            });

        continue;
}

            // Only calculate refunds in the order's currency
            if (refund.currency !== order.currency) {
    issues.push({
        type: "currency_mismatch",
        refundId: refund.refundId,
        message: `Refund currency ${refund.currency} does not match order currency ${order.currency}`
    });

    continue;
}

            if (refund.status === "refunded") {
                refundedAmount += refund.amount;
            }

            if (refund.status === "pending") {
                pendingAmount += refund.amount;
            }
        }

        const remainingAmount = Math.max(
            totalAmount - refundedAmount - pendingAmount,
            0
        );
        const overRefundedAmount = Math.max(
    refundedAmount - totalAmount,
    0
);
const overRequestedAmount = Math.max(
    refundedAmount + pendingAmount - totalAmount,
    0
);

let status = "normal";

if (overRefundedAmount > 0) {
    status = "over_refunded";
} else if (overRequestedAmount > 0) {
    status = "over_requested";
} else if (pendingAmount > 0) {
    status = "pending";
} else if (refundedAmount > 0) {
    status = "refunded";
}

        orderStates.push({
            orderId: order.order_id,
            customerId: order.customer_id,
            currency: order.currency,

            totalAmount,
            refundedAmount,
            pendingAmount,
            remainingAmount,
            overRefundedAmount,
            overRequestedAmount,

            status,
            hasChargeback,
            issues,

            refunds: orderRefunds
        });
    }

    return {
    orders: orderStates,
    orphanRefunds
};
}
module.exports = {
    loadOrders,
    loadEvents,
    deduplicateEvents,
    groupEventsByRefund,
    getRefundStatus,
    getRefundAmount,
    calculateOrderState
};
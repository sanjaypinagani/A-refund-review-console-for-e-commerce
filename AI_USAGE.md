1)first i asked ai to structure the initial setup for backend to start with logic directly.
2)next i took its help to breakdown the work into smaller parts like data loading, event deduplication, refund grouping etc.
3)then to generate initial version of the Express endpoints and simple HTML,JavaScript UI.
4)then asked it to anlayse the date  to find any anomalies, like duplicate eventids , negative amounts etc
5)i found that there are over refunds and currency mismatches in it. and asked it to keep seperate currencies.
6)ai found orphan order in data.i.e, order is not present in orders.csv file
7)i told the logic to it like if a refund is requested and later is succeeded then it is success even it fails afterwards etc.
8)At one point I was checking why the dataset contained 214 events while only 213 event IDs were unique. AI initially discussed the distinction between event IDs and refund IDs, but this could easily have led to the wrong conclusion if I had treated "refund count" and "event count" as the same thing.
9)The first version of the order detail page used one HTML element for refund decisions.That was incomplete because an order can have multiple pending refunds.When multiple refunds called the decision-loading function, they all tried to update the same element. This resulted in the decision for one refund overwriting another, which became particularly visible when the last refund row was involved.I noticed this while testing the UI with orders containing multiple refunds.I changed the implementation so each refund gets its own element.
10)The supplied data contains a negative refund amount-₹350 An earlier approach normalized negative amounts to zero. but it is wrong.
 because it would make the malformed event disappear from the financial calculation without telling the agent that the source data was invalid.
I changed the approach.The negative amount is now treated as a data-quality issue and excluded from the refund totals.The UI can still show the original negative amount so the operator can see what was present in the source data.
11)I did not rely only on simply reading the generated code.I verified the implementation by running the application and checking the derived API output against known cases from the supplied data.
12)I checked ord_1014 and verified that the chargeback creates a separate signal and does not get added to the refund amount
13)AI was useful for generating suggesting edge cases, explaining errors, and iterating on implementation.

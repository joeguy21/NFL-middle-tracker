const assert=require("node:assert/strict");
const {buildCoordinatedAlertCandidate}=require("./coordinated-alert-candidate");
assert.equal(typeof buildCoordinatedAlertCandidate,"function");
console.log("Alert persistence integration contract module loads.");

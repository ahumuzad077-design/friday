export const APPROVAL_REQUIRED_ACTIONS = new Set([
  "sign_contract",
  "legal_commitment",
  "issue_shares",
  "transfer_shares",
  "public_securities_offer",
  "major_financial_transfer",
  "strategic_control_change",
  "final_investment_close"
]);

export function requiresApproval(action) {
  return APPROVAL_REQUIRED_ACTIONS.has(action);
}

export function publicOfferAllowed(state) {
  return state.project.publicOfferEnabled === true;
}

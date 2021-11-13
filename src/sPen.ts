import { RebaseCall } from "../generated/sPen/sPen";
import { Pen } from "../generated/sPen/Pen";
import { createDailyStakingReward } from "./utils/DailyStakingReward";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { Rebase } from "../generated/schema";
import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { STAKING_CONTRACT, PEN_CONTRACT } from "./utils/Constants";
import { toDecimal } from "./utils/Decimals";
import { getPENUSDRate } from "./utils/Price";

export function rebaseFunction(call: RebaseCall): void {
  let transaction = loadOrCreateTransaction(call.transaction, call.block);
  var rebase = Rebase.load(transaction.id);
  log.debug("Rebase_V2 event on TX {} with amount {}", [
    transaction.id,
    toDecimal(call.inputs.profit_, 9).toString(),
  ]);

  if (rebase == null && call.inputs.profit_.gt(BigInt.fromI32(0))) {
    let pen_contract = Pen.bind(Address.fromString(PEN_CONTRACT));

    rebase = new Rebase(transaction.id);
    rebase.amount = toDecimal(call.inputs.profit_, 9);
    rebase.stakedPens = toDecimal(
      pen_contract.balanceOf(Address.fromString(STAKING_CONTRACT)),
      9
    );
    rebase.contract = STAKING_CONTRACT;
    rebase.percentage = rebase.amount.div(rebase.stakedPens);
    rebase.transaction = transaction.id;
    rebase.timestamp = transaction.timestamp;
    rebase.value = rebase.amount.times(getPENUSDRate());
    rebase.save();

    createDailyStakingReward(rebase.timestamp, rebase.amount);
  }
}

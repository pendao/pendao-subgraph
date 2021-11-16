import { LogRebase } from "../generated/sPen/sPen";
import { Pen } from "../generated/sPen/Pen";
import { createDailyStakingReward } from "./utils/DailyStakingReward";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { Rebase } from "../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { STAKING_CONTRACT, PEN_CONTRACT } from "./utils/Constants";
import { toDecimal } from "./utils/Decimals";
import { getPENUSDRate } from "./utils/Price";

export function rebaseFunction(e: LogRebase): void {
  let transaction = loadOrCreateTransaction(e.transaction, e.block);
  var rebase = Rebase.load(transaction.id);
  if (rebase == null && e.params.profit.gt(BigInt.fromI32(0))) {
    let pen_contract = Pen.bind(Address.fromString(PEN_CONTRACT));
    rebase = new Rebase(transaction.id);
    rebase.amount = toDecimal(e.params.profit, 9);
    var stakedPens = toDecimal(
      pen_contract.balanceOf(Address.fromString(STAKING_CONTRACT)),
      9
    );

    rebase.stakedPens = stakedPens;
    rebase.contract = STAKING_CONTRACT;
    rebase.percentage =toDecimal(e.params.rebase, 18);
    rebase.transaction = transaction.id;
    rebase.timestamp = transaction.timestamp;
    rebase.value = rebase.amount.times(getPENUSDRate());
    rebase.save();
    createDailyStakingReward(rebase.timestamp, rebase.amount);
  }
}

import { Address } from "@graphprotocol/graph-ts";
import { Stake, Unstake } from "../generated/schema";

import { StakeCall } from "../generated/PenStakingHelper/PenStakingHelper";
import { toDecimal } from "./utils/Decimals";
import { loadOrCreatePENie, updatePenieBalance } from "./utils/PENie";
import { loadOrCreateTransaction } from "./utils/Transactions";

export function handleStake(call: StakeCall): void {
  let penie = loadOrCreatePENie(call.from as Address);
  let transaction = loadOrCreateTransaction(call.transaction, call.block);
  let value = toDecimal(call.inputs._amount, 9);

  let stake = new Stake(transaction.id);
  stake.transaction = transaction.id;
  stake.penie = penie.id;
  stake.amount = value;
  stake.timestamp = transaction.timestamp;
  stake.save();

  updatePenieBalance(penie, transaction);
}

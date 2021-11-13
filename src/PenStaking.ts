import { Address } from "@graphprotocol/graph-ts";
import { Stake, Unstake } from "../generated/schema";

import { StakeCall, UnstakeCall } from "../generated/PenStaking/PenStaking";
import { toDecimal } from "./utils/Decimals";
import { loadOrCreatePENie, updatePenieBalance } from "./utils/PENie";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { updateProtocolMetrics } from "./utils/ProtocolMetrics";

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
  updateProtocolMetrics(transaction);
}

export function handleUnstake(call: UnstakeCall): void {
  let penie = loadOrCreatePENie(call.from as Address);
  let transaction = loadOrCreateTransaction(call.transaction, call.block);
  let value = toDecimal(call.inputs._amount, 9);

  let unstake = new Unstake(transaction.id);
  unstake.transaction = transaction.id;
  unstake.penie = penie.id;
  unstake.amount = value;
  unstake.timestamp = transaction.timestamp;
  unstake.save();

  updatePenieBalance(penie, transaction);
  updateProtocolMetrics(transaction);
}

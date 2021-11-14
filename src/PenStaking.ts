import { Address } from "@graphprotocol/graph-ts";
import { Stake, Unstake } from "../generated/schema";

import { Claimed } from "../generated/PenStaking/PenStaking";
import { toDecimal } from "./utils/Decimals";
import { loadOrCreatePENie, updatePenieBalance } from "./utils/PENie";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { updateProtocolMetrics } from "./utils/ProtocolMetrics";

export function handleStake(e: Claimed): void {
  let penie = loadOrCreatePENie(e.transaction.from as Address);
  let transaction = loadOrCreateTransaction(e.transaction, e.block);
  let value = toDecimal(e.params._amount, 9);

  let stake = new Stake(transaction.id);
  stake.transaction = transaction.id;
  stake.penie = penie.id;
  stake.amount = value;
  stake.timestamp = transaction.timestamp;
  stake.save();

  updatePenieBalance(penie, transaction);
  updateProtocolMetrics(transaction);
}

export function handleUnstake(e: Claimed): void {
  let penie = loadOrCreatePENie(e.transaction.from as Address);
  let transaction = loadOrCreateTransaction(e.transaction, e.block);
  let value = toDecimal(e.params._amount, 9);

  let unstake = new Unstake(transaction.id);
  unstake.transaction = transaction.id;
  unstake.penie = penie.id;
  unstake.amount = value;
  unstake.timestamp = transaction.timestamp;
  unstake.save();

  updatePenieBalance(penie, transaction);
  updateProtocolMetrics(transaction);
}

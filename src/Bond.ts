import { Address } from "@graphprotocol/graph-ts";

import { DepositCall, RedeemCall } from "../generated/USDTBond/Bond";
import { Deposit } from "../generated/schema";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { loadOrCreatePENie, updatePenieBalance } from "./utils/PENie";
import { toDecimal } from "./utils/Decimals";
import { USDT_CONTRACT } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { loadOrCreateRedemption } from "./utils/Redemption";
import { createDailyBondRecord } from "./utils/DailyBond";

export function handleDeposit(call: DepositCall): void {
  let penie = loadOrCreatePENie(call.transaction.from);
  let transaction = loadOrCreateTransaction(call.transaction, call.block);
  let token = loadOrCreateToken(USDT_CONTRACT);

  let amount = toDecimal(call.inputs._amount, 18);
  let deposit = new Deposit(transaction.id);
  deposit.transaction = transaction.id;
  deposit.penie = penie.id;
  deposit.amount = amount;
  deposit.value = amount;
  deposit.maxPremium = toDecimal(call.inputs._maxPrice);
  deposit.token = token.id;
  deposit.timestamp = transaction.timestamp;
  deposit.save();

  createDailyBondRecord(
    deposit.timestamp,
    token,
    deposit.amount,
    deposit.value
  );
  updatePenieBalance(penie, transaction);
}

export function handleRedeem(call: RedeemCall): void {
  let penie = loadOrCreatePENie(call.transaction.from);
  let transaction = loadOrCreateTransaction(call.transaction, call.block);

  let redemption = loadOrCreateRedemption(call.transaction.hash as Address);
  redemption.transaction = transaction.id;
  redemption.penie = penie.id;
  redemption.token = loadOrCreateToken(USDT_CONTRACT).id;
  redemption.timestamp = transaction.timestamp;
  redemption.save();
  updatePenieBalance(penie, transaction);
}
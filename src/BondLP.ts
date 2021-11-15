import { Address } from "@graphprotocol/graph-ts";

import { BondCreated, BondRedeemed } from "../generated/USDTBond/Bond";
import { Deposit } from "../generated/schema";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { loadOrCreatePENie, updatePenieBalance } from "./utils/PENie";
import { toDecimal } from "./utils/Decimals";
import { USDT_CONTRACT } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { loadOrCreateRedemption } from "./utils/Redemption";
import { createDailyBondRecord } from "./utils/DailyBond";
import { getPairUSD } from "./utils/Price";

export function handleDeposit(e: BondCreated): void {
  let penie = loadOrCreatePENie(e.transaction.from);
  let transaction = loadOrCreateTransaction(e.transaction, e.block);
  let token = loadOrCreateToken(e.address.toHex());

  let amount = toDecimal(e.params.deposit, 18);
  let deposit = new Deposit(transaction.id);
  deposit.transaction = transaction.id;
  deposit.penie = penie.id;
  deposit.amount = amount;
  deposit.value = getPairUSD(e.params.payout, e.address.toHex())
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

export function handleRedeem(e: BondRedeemed): void {
  let penie = loadOrCreatePENie(e.transaction.from);
  let transaction = loadOrCreateTransaction(e.transaction, e.block);

  let redemption = loadOrCreateRedemption(e.transaction.hash as Address);
  redemption.transaction = transaction.id;
  redemption.penie = penie.id;
  redemption.token = loadOrCreateToken(e.address.toHex()).id;
  redemption.timestamp = transaction.timestamp;
  redemption.save();
  updatePenieBalance(penie, transaction);
}

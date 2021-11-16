import { Address } from "@graphprotocol/graph-ts";

import { Bond, BondCreated, BondRedeemed } from "../generated/USDTBond/Bond";
import { Deposit } from "../generated/schema";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { loadOrCreatePENie, updatePenieBalance } from "./utils/PENie";
import { toDecimal } from "./utils/Decimals";
import { USDT_CONTRACT } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { loadOrCreateRedemption } from "./utils/Redemption";
import { createDailyBondRecord } from "./utils/DailyBond";

export function handleDeposit(e: BondCreated): void {
  let penie = loadOrCreatePENie(e.transaction.from);
  let transaction = loadOrCreateTransaction(e.transaction, e.block);
  let bond = Bond.bind(e.address)
  let tokenAddr = bond.principle().toHex();

  let token = loadOrCreateToken(tokenAddr);

  let amount = toDecimal(e.params.deposit, 18);
  let deposit = new Deposit(transaction.id);
  deposit.transaction = transaction.id;
  deposit.penie = penie.id;
  deposit.amount = amount;
  deposit.value = amount;
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

  let bond = Bond.bind(e.address)
  let tokenAddr = bond.principle().toHex();

  let redemption = loadOrCreateRedemption(e.transaction.hash as Address);
  redemption.transaction = transaction.id;
  redemption.penie = penie.id;
  redemption.token = loadOrCreateToken(tokenAddr).id;
  redemption.timestamp = transaction.timestamp;
  redemption.save();
  updatePenieBalance(penie, transaction);
}

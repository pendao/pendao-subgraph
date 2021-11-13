import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { BondDiscount, Transaction } from "../../generated/schema";
import { hourFromTimestamp } from "./Dates";
import { getPENUSDRate } from "./Price";

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount {
  let hourTimestamp = hourFromTimestamp(timestamp);

  let bondDiscount = BondDiscount.load(hourTimestamp);
  if (bondDiscount == null) {
    bondDiscount = new BondDiscount(hourTimestamp);
    bondDiscount.timestamp = timestamp;
    bondDiscount.usdt_discount = BigDecimal.fromString("0");
    bondDiscount.penusdt_discount = BigDecimal.fromString("0");
    bondDiscount.save();
  }
  return bondDiscount as BondDiscount;
}

export function updateBondDiscounts(transaction: Transaction): void {
  let bd = loadOrCreateBondDiscount(transaction.timestamp);
  let penRate = getPENUSDRate();
  bd.save();
}

import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import { BondDiscount, Transaction } from "../../generated/schema";
import { Bond } from "../../generated/USDTBond/Bond";
import { PENUSDTBOND_ADDRESS, PENUSDTBOND_CONTRACT_BLOCK, USDTBOND_ADDRESS, USDTBOND_CONTRACT_BLOCK } from "./Constants";
import { hourFromTimestamp } from "./Dates";
import { toDecimal } from "./Decimals";
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

  // USDT
  if(transaction.blockNumber.gt(BigInt.fromString(USDTBOND_CONTRACT_BLOCK))){
    let bond = Bond.bind(Address.fromString(USDTBOND_ADDRESS))
    let price_call = bond.try_bondPriceInUSD()
    if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
        bd.usdt_discount = penRate.div(toDecimal(price_call.value, 18))
        bd.usdt_discount = bd.usdt_discount.minus(BigDecimal.fromString("1"))
        bd.usdt_discount = bd.usdt_discount.times(BigDecimal.fromString("100"))
    }    
  }

  // PEN/USDT
  if(transaction.blockNumber.gt(BigInt.fromString(PENUSDTBOND_CONTRACT_BLOCK))){
    let bond = Bond.bind(Address.fromString(PENUSDTBOND_ADDRESS))
    let price_call = bond.try_bondPriceInUSD()
    if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
        bd.penusdt_discount = penRate.div(toDecimal(price_call.value, 18))
        bd.penusdt_discount = bd.penusdt_discount.minus(BigDecimal.fromString("1"))
        bd.penusdt_discount = bd.penusdt_discount.times(BigDecimal.fromString("100"))
    }    
  }

  bd.save();
}

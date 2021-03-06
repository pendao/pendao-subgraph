import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Penie, Transaction } from "../../generated/schema";
import { Pen } from "../../generated/sPen/Pen";
import { sPen } from "../../generated/sPen/sPen";
import { Bond } from "../../generated/USDTBond/Bond";

import {
  PENUSDTBOND_ADDRESS,
  PENUSDTBOND_CONTRACT_BLOCK,
  PENUSDTLPBOND_TOKEN,
  PEN_CONTRACT,
  SPEN_CONTRACT,
  USDTBOND_ADDRESS,
  USDTBOND_CONTRACT_BLOCK,
} from "../utils/Constants";
import { loadOrCreatePenieBalance } from "./PenieBalances";
import { toDecimal } from "./Decimals";
import { getPENUSDRate } from "./Price";
import { loadOrCreateContractInfo } from "./ContractInfo";
import { getHolderAux } from "./Aux";

export function loadOrCreatePENie(addres: Address): Penie {
  let penie = Penie.load(addres.toHex());
  if (penie == null) {
    let holders = getHolderAux();
    holders.value = holders.value.plus(BigInt.fromI32(1));
    holders.save();

    penie = new Penie(addres.toHex());
    penie.active = true;
    penie.save();
  }
  return penie as Penie;
}

export function updatePenieBalance(
  penie: Penie,
  transaction: Transaction
): void {
  let balance = loadOrCreatePenieBalance(penie, transaction.timestamp);

  let pen_contract = Pen.bind(Address.fromString(PEN_CONTRACT));
  let spen_contract = sPen.bind(Address.fromString(SPEN_CONTRACT));
  balance.penBalance = toDecimal(
    pen_contract.balanceOf(Address.fromString(penie.id)),
    9
  );
  let spenBalance = toDecimal(
    spen_contract.balanceOf(Address.fromString(penie.id)),
    9
  );
  balance.spenBalance = spenBalance;

  let stakes = balance.stakes;

  let cinfoSpenBalance = loadOrCreateContractInfo(
    penie.id + transaction.timestamp.toString() + "sPen"
  );
  cinfoSpenBalance.name = "sPEN";
  cinfoSpenBalance.contract = SPEN_CONTRACT;
  cinfoSpenBalance.amount = spenBalance;
  cinfoSpenBalance.save();
  stakes.push(cinfoSpenBalance.id);
  balance.stakes = stakes;

  if (
    penie.active &&
    balance.penBalance.lt(BigDecimal.fromString("0.01")) &&
    balance.spenBalance.lt(BigDecimal.fromString("0.01"))
  ) {
    let holders = getHolderAux();
    holders.value = holders.value.minus(BigInt.fromI32(1));
    holders.save();
    penie.active = false;
  } else if (
    penie.active == false &&
    (balance.penBalance.gt(BigDecimal.fromString("0.01")) ||
      balance.spenBalance.gt(BigDecimal.fromString("0.01")))
  ) {
    let holders = getHolderAux();
    holders.value = holders.value.plus(BigInt.fromI32(1));
    holders.save();
    penie.active = true;
  }

  let bonds = balance.bonds;

  // USDT BOND
  if (transaction.blockNumber.gt(BigInt.fromString(USDTBOND_CONTRACT_BLOCK))) {
    let usdtBond_contract = Bond.bind(Address.fromString(USDTBOND_ADDRESS));
    let pending = usdtBond_contract.bondInfo(Address.fromString(penie.id));
    if (pending.value1.gt(BigInt.fromString("0"))) {
      let pending_bond = toDecimal(pending.value1, 9);
      balance.bondBalance = balance.bondBalance.plus(pending_bond);

      let binfo = loadOrCreateContractInfo(
        penie.id + transaction.timestamp.toString() + "USDBond"
      );
      binfo.name = "USDT";
      binfo.contract = USDTBOND_ADDRESS;
      binfo.amount = pending_bond;
      binfo.save();
      bonds.push(binfo.id);

      log.debug("Penie {} pending USDBond V1 {} on tx {}", [
        penie.id,
        toDecimal(pending.value1, 9).toString(),
        transaction.id,
      ]);
    }
  }

  //PEN-USDT
  if (
    transaction.blockNumber.gt(BigInt.fromString(PENUSDTBOND_CONTRACT_BLOCK))
  ) {
    let bondPENUsdt_contract = Bond.bind(
      Address.fromString(PENUSDTBOND_ADDRESS)
    );
    let pending = bondPENUsdt_contract.bondInfo(Address.fromString(penie.id));
    if (pending.value1.gt(BigInt.fromString("0"))) {
      let pending_bond = toDecimal(pending.value1, 9);
      balance.bondBalance = balance.bondBalance.plus(pending_bond);

      let binfo = loadOrCreateContractInfo(
        penie.id + transaction.timestamp.toString() + PENUSDTLPBOND_TOKEN
      );
      binfo.name = PENUSDTLPBOND_TOKEN;
      binfo.contract = PENUSDTBOND_ADDRESS;
      binfo.amount = pending_bond;
      binfo.save();
      bonds.push(binfo.id);

      log.debug("Penie {} pending PENUSDT {} on tx {}", [
        penie.id,
        toDecimal(pending.value1, 9).toString(),
        transaction.id,
      ]);
    }
  }

  balance.bonds = bonds;

  //Price
  let usdRate = getPENUSDRate();
  balance.dollarBalance = balance.penBalance
    .times(usdRate)
    .plus(balance.spenBalance.times(usdRate))
    .plus(balance.bondBalance.times(usdRate));
  balance.save();

  penie.lastBalance = balance.id;
  penie.save();
}

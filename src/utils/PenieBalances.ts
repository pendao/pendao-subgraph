import { BigDecimal, BigInt, Address } from "@graphprotocol/graph-ts";
import { Penie, PenieBalance } from "../../generated/schema";

export function loadOrCreatePenieBalance(
  penie: Penie,
  timestamp: BigInt
): PenieBalance {
  let id = timestamp.toString() + penie.id;

  let penieBalance = PenieBalance.load(id);
  if (penieBalance == null) {
    penieBalance = new PenieBalance(id);
    penieBalance.penie = penie.id;
    penieBalance.timestamp = timestamp;
    penieBalance.spenBalance = BigDecimal.fromString("0");
    penieBalance.penBalance = BigDecimal.fromString("0");
    penieBalance.bondBalance = BigDecimal.fromString("0");
    penieBalance.dollarBalance = BigDecimal.fromString("0");
    penieBalance.stakes = [];
    penieBalance.bonds = [];
    penieBalance.save();
  }
  return penieBalance as PenieBalance;
}

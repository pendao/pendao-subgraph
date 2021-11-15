import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { UniswapV2Pair } from "../../generated/sPen/UniswapV2Pair";
import { ERC20 } from "../../generated/PenStaking/ERC20";
import { CirculatingSupply } from "../../generated/PenStaking/CirculatingSupply";

import { ProtocolMetric, Transaction } from "../../generated/schema";
import {
  BECO_PENUSDT_PAIR,
  CIRCULATING_SUPPLY_CONTRACT,
  CIRCULATING_SUPPLY_CONTRACT_BLOCK,
  PEN_CONTRACT,
  SPEN_CONTRACT,
  STAKING_CONTRACT,
  TREASURY_ADDRESS,
  USDT_CONTRACT,
} from "./Constants";
import { dayFromTimestamp } from "./Dates";
import { toDecimal } from "./Decimals";
import { getDiscountedPairUSD, getPairUSD, getPENUSDRate } from "./Price";
import { getHolderAux } from "./Aux";
import { updateBondDiscounts } from "./BondDiscounts";
import { Pen } from "../../generated/sPen/Pen";
import { sPen } from "../../generated/sPen/sPen";
import { PenStaking } from "../../generated/PenStaking/PenStaking";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  let dayTimestamp = dayFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dayTimestamp);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dayTimestamp);
    protocolMetric.timestamp = timestamp;
    protocolMetric.penCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.sPenCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.totalSupply = BigDecimal.fromString("0");
    protocolMetric.penPrice = BigDecimal.fromString("0");
    protocolMetric.marketCap = BigDecimal.fromString("0");
    protocolMetric.totalValueLocked = BigDecimal.fromString("0");
    protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryMarketValue = BigDecimal.fromString("0");
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.nextDistributedPen = BigDecimal.fromString("0");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.treasuryUsdtRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryUsdtMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryPenUsdtPOL = BigDecimal.fromString("0");
    protocolMetric.holders = BigInt.fromI32(0);

    protocolMetric.save();
  }
  return protocolMetric as ProtocolMetric;
}

function getTotalSupply(): BigDecimal {
  let pen_contract = Pen.bind(Address.fromString(PEN_CONTRACT));
  let total_supply = toDecimal(pen_contract.totalSupply(), 9);
  log.debug("Total Supply {}", [total_supply.toString()]);
  return total_supply;
}

function getCriculatingSupply(transaction: Transaction, total_supply: BigDecimal): BigDecimal{
  let circ_supply = BigDecimal.fromString("0")
  if(transaction.blockNumber.gt(BigInt.fromString(CIRCULATING_SUPPLY_CONTRACT_BLOCK))){
      let circulatingsupply_contract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
      circ_supply = toDecimal(circulatingsupply_contract.PENCirculatingSupply(), 9)
  }
  else{
      circ_supply = total_supply;
  }
  log.debug("Circulating Supply {}", [total_supply.toString()])
  return circ_supply
}

function getSpenSupply(transaction: Transaction): BigDecimal {
  let spen_supply = BigDecimal.fromString("0");
  let spen_contract_v2 = sPen.bind(Address.fromString(SPEN_CONTRACT));
  spen_supply = spen_supply.plus(
    toDecimal(spen_contract_v2.circulatingSupply(), 9)
  );
  log.debug("sPEN Supply {}", [spen_supply.toString()]);
  return spen_supply;
}

function getMV_RFV(transaction: Transaction): BigDecimal[] {
  let usdtERC20 = ERC20.bind(Address.fromString(USDT_CONTRACT));
  let penUsdtPair = UniswapV2Pair.bind(Address.fromString(BECO_PENUSDT_PAIR));

  let usdtBalance = usdtERC20.balanceOf(Address.fromString(TREASURY_ADDRESS));

  //PENUSDT
  let penUsdtBalance = penUsdtPair.balanceOf(
    Address.fromString(TREASURY_ADDRESS)
  );

  let penUsdtTotalLP = toDecimal(penUsdtPair.totalSupply(), 18);
  let penUsdtPOL = toDecimal(penUsdtBalance, 18)
    .div(penUsdtTotalLP)
    .times(BigDecimal.fromString("100"));

  let penUsdt_value = getPairUSD(penUsdtBalance, BECO_PENUSDT_PAIR);
  let penUsdt_rfv = getDiscountedPairUSD(penUsdtBalance, BECO_PENUSDT_PAIR);

  let stableValue = usdtBalance;
  let stableValueDecimal = toDecimal(stableValue, 18);

  let lpValue = penUsdt_value;
  let rfvLpValue = penUsdt_rfv;

  let mv = stableValueDecimal.plus(lpValue);
  let rfv = stableValueDecimal.plus(rfvLpValue);

  return [
    mv,
    rfv,
    // treasuryDaiRiskFreeValue = USDT RFV * USDT
    penUsdt_rfv.plus(toDecimal(usdtBalance, 18)),
    // treasuryDaiMarketValue = PENUSDT LP * USDT
    penUsdt_value.plus(toDecimal(usdtBalance, 18)),
    // POL
    penUsdtPOL,
  ];
}

function getNextPENRebase(transaction: Transaction): BigDecimal {
  let next_distribution = BigDecimal.fromString("0");

  let staking_contract = PenStaking.bind(Address.fromString(STAKING_CONTRACT));
  let distribution_v2 = toDecimal(staking_contract.epoch().value3, 9);
  log.debug("next_distribution v2 {}", [distribution_v2.toString()]);
  next_distribution = next_distribution.plus(distribution_v2);

  log.debug("next_distribution total {}", [next_distribution.toString()]);

  return next_distribution;
}
function getAPY_Rebase(sPEN: BigDecimal, distributedPEN: BigDecimal): BigDecimal[]{
  let nextEpochRebase = distributedPEN.div(sPEN).times(BigDecimal.fromString("100"));

  let nextEpochRebase_number = Number.parseFloat(nextEpochRebase.toString())
  let currentAPY = Math.pow(((nextEpochRebase_number/100)+1), (365*3)-1)*100
  if (!isFinite(currentAPY)) {
    currentAPY = 0
  }

  let currentAPYdecimal = BigDecimal.fromString(nextEpochRebase_number.toString())


  return [currentAPYdecimal, nextEpochRebase]
}


function getRunway(
  sPEN: BigDecimal,
  rfv: BigDecimal,
  rebase: BigDecimal
): BigDecimal[] {
  let runway2dot5k = BigDecimal.fromString("0");
  let runway5k = BigDecimal.fromString("0");
  let runway7dot5k = BigDecimal.fromString("0");
  let runway10k = BigDecimal.fromString("0");
  let runway20k = BigDecimal.fromString("0");
  let runway50k = BigDecimal.fromString("0");
  let runway70k = BigDecimal.fromString("0");
  let runway100k = BigDecimal.fromString("0");
  let runwayCurrent = BigDecimal.fromString("0");

  if (
    sPEN.gt(BigDecimal.fromString("0")) &&
    rfv.gt(BigDecimal.fromString("0")) &&
    rebase.gt(BigDecimal.fromString("0"))
  ) {
    let treasury_runway = Number.parseFloat(rfv.div(sPEN).toString());

    let runway2dot5k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.0029438) / 3;
    let runway5k_num = Math.log(treasury_runway) / Math.log(1 + 0.003579) / 3;
    let runway7dot5k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.0039507) / 3;
    let runway10k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00421449) / 3;
    let runway20k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00485037) / 3;
    let runway50k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00569158) / 3;
    let runway70k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00600065) / 3;
    let runway100k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00632839) / 3;
    let nextEpochRebase_number = Number.parseFloat(rebase.toString()) / 100;
    let runwayCurrent_num =
      Math.log(treasury_runway) / Math.log(1 + nextEpochRebase_number) / 3;

    runway2dot5k = BigDecimal.fromString(runway2dot5k_num.toString());
    runway5k = BigDecimal.fromString(runway5k_num.toString());
    runway7dot5k = BigDecimal.fromString(runway7dot5k_num.toString());
    runway10k = BigDecimal.fromString(runway10k_num.toString());
    runway20k = BigDecimal.fromString(runway20k_num.toString());
    runway50k = BigDecimal.fromString(runway50k_num.toString());
    runway70k = BigDecimal.fromString(runway70k_num.toString());
    runway100k = BigDecimal.fromString(runway100k_num.toString());
    runwayCurrent = BigDecimal.fromString(runwayCurrent_num.toString());
  }

  return [
    runway2dot5k,
    runway5k,
    runway7dot5k,
    runway10k,
    runway20k,
    runway50k,
    runway70k,
    runway100k,
    runwayCurrent,
  ];
}

export function updateProtocolMetrics(transaction: Transaction): void {
  let pm = loadOrCreateProtocolMetric(transaction.timestamp);

  //Total Supply
  pm.totalSupply = getTotalSupply();

  //Circ Supply
  pm.penCirculatingSupply = getCriculatingSupply(transaction, pm.totalSupply);

  //sPen Supply
  pm.sPenCirculatingSupply = getSpenSupply(transaction);

  //PEN Price
  pm.penPrice = getPENUSDRate();

  //PEN Market Cap
  pm.marketCap = pm.penCirculatingSupply.times(pm.penPrice);

  //Total Value Locked
  pm.totalValueLocked = pm.sPenCirculatingSupply.times(pm.penPrice);

  //Treasury RFV and MV
  let mv_rfv = getMV_RFV(transaction);
  pm.treasuryMarketValue = mv_rfv[0];
  pm.treasuryRiskFreeValue = mv_rfv[1];
  pm.treasuryUsdtRiskFreeValue = mv_rfv[2];
  pm.treasuryUsdtMarketValue = mv_rfv[3];
  pm.treasuryPenUsdtPOL = mv_rfv[4];

  // // Rebase rewards, APY, rebase
  pm.nextDistributedPen = getNextPENRebase(transaction);
  let apy_rebase = getAPY_Rebase(
    pm.sPenCirculatingSupply,
    pm.nextDistributedPen
  );
  pm.currentAPY = apy_rebase[0];
  pm.nextEpochRebase = apy_rebase[1];

  //Runway
  let runways = getRunway(
    pm.sPenCirculatingSupply,
    pm.treasuryRiskFreeValue,
    pm.nextEpochRebase
  );
  pm.runway2dot5k = runways[0];
  pm.runway5k = runways[1];
  pm.runway7dot5k = runways[2];
  pm.runway10k = runways[3];
  pm.runway20k = runways[4];
  pm.runway50k = runways[5];
  pm.runway70k = runways[6];
  pm.runway100k = runways[7];
  pm.runwayCurrent = runways[8];

  //Holders
  pm.holders = getHolderAux().value;

  pm.save();

  updateBondDiscounts(transaction);
}

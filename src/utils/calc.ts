import axios from 'axios';

const KS5M_HASHRATE_TH = 15;
const KS5M_POWER_WATT = 3400;
const TH_TO_H = 1e12;

export async function getKaspaNetworkHashrate(): Promise<number> {
  const res = await axios.get('https://api.kaspa.org/info/hashrate');
  return Number(res.data.hashrate) * TH_TO_H;
}

export async function getKaspaBlockReward(): Promise<number> {
//   const res = await axios.get('https://api.minerstat.com/v2/coins?list=KAS');
//   return Number(res.data[0].reward_block);
    const res = await axios.get('https://api.kaspa.org/info/blockreward');
    return Number(res.data.blockreward);
}

export async function getKaspaPrice(): Promise<number> {
  const res = await axios.get('https://api.kaspa.org/info/price');
  return Number(res.data.price);
}

export async function calculateSiteProfit({
  numMachines,
  powerRate,
}: {
  numMachines: number;
  powerRate: number;
}) {
  const [
    networkHashrate,
    blockReward,
    kasPrice
  ] = await Promise.all([
    getKaspaNetworkHashrate(),
    getKaspaBlockReward(),
    getKaspaPrice()
  ]);

  const machineHashrateH = KS5M_HASHRATE_TH * TH_TO_H;
  // const blocksPerDay = 24 * 3600 *0.98;
  const blocksPerHour = 3600 *0.98;

  // const dailyKasPerMachine = (machineHashrateH / networkHashrate) * blocksPerDay * blockReward*0.98;
  // const dailyKas = dailyKasPerMachine * numMachines;
  // const dailyRevenue = dailyKas * kasPrice;

  const hourlyKasPerMachine = (machineHashrateH / networkHashrate) * blocksPerHour * blockReward*0.98;
  const hourlyKas = hourlyKasPerMachine * numMachines;
  const hourlyRevenue = hourlyKas * kasPrice;

  // const dailyPowerCost = ((KS5M_POWER_WATT * 24) / 1000) * powerRate * numMachines;
  // const dailyProfit = dailyRevenue - dailyPowerCost;

  const hourlyPowerCost = ((KS5M_POWER_WATT) / 1000) * powerRate * numMachines;
  const hourlyProfit = hourlyRevenue - hourlyPowerCost;

  // const unitPowerCost = ((KS5M_POWER_WATT * 24) / 1000) * powerRate;
  // const unitProfit = (dailyKasPerMachine * kasPrice) - unitPowerCost;

  const unitPowerCost = ((KS5M_POWER_WATT) / 1000) * powerRate;
  const unitProfit = (hourlyKasPerMachine * kasPrice) - unitPowerCost;

  console.log(`block reward: ${blockReward} KAS`)

  return {
    kas_price: kasPrice.toFixed(5),
    hourly_kas: hourlyKas.toFixed(2),
    revenue: hourlyRevenue.toFixed(2),
    cost: hourlyPowerCost.toFixed(2),
    profit: hourlyProfit.toFixed(2),
    unit_profit: unitProfit.toFixed(2),
    network_hashrate: (networkHashrate / 1e12).toFixed(2)
  };

  // return {
  //   kas_price: kasPrice.toFixed(5),
  //   daily_kas: dailyKas.toFixed(2),
  //   revenue: dailyRevenue.toFixed(2),
  //   cost: dailyPowerCost.toFixed(2),
  //   profit: dailyProfit.toFixed(2),
  //   unit_profit: unitProfit.toFixed(2),
  //   network_hashrate: (networkHashrate / 1e12).toFixed(2)
  // };
}


import { Request, Response } from 'express';
import { Site } from '../models/Site';
import { calculateSiteProfit } from '../utils/calc';

export const getIndexPage = async (req: Request, res: Response) => {
    const db = req.app.locals.db;
    const sites: Site[] = await db.all('SELECT * FROM sites');
  
    const sitesWithCalc = await Promise.all(sites.map(async site => {
      const result = await calculateSiteProfit({
        numMachines: site.num_machines,
        powerRate: site.power_rate
      });
  
      return {
        ...site,
        ...result
      };
    }));

    const networkHashrateTH = sitesWithCalc.length > 0 ? sitesWithCalc[0].network_hashrate : 'N/A';

    res.render('index', {
        sites: sitesWithCalc,
        // networkHashrateDisplay: formatHashrate(networkHashrateTH)
        networkHashrateTH,
        updatedTime: new Date().toLocaleString()
    });
  
  };

//   function formatHashrate(hashrate: number): string {
//     if (hashrate >= 1e15) return (hashrate / 1e15).toFixed(2) + ' PH/s';
//     if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
//     if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
//     return hashrate + ' H/s';
//   }

export const postAddSite = async (req: Request, res: Response) => {
  const db = req.app.locals.db;
  const { name, num_machines, machine_type, power_rate } = req.body;

  await db.run(
    'INSERT INTO sites (name, num_machines, machine_type, power_rate) VALUES (?, ?, ?, ?)',
    [name, num_machines, machine_type, power_rate]
  );

  res.redirect('/');
};



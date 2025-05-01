// src/controllers/siteController.ts
import { Request, Response } from 'express';
import { Site } from '../models/Site';
import { calculateSiteProfit } from '../utils/calc';

export const getIndexPage = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const sites: Site[] = await db.all('SELECT * FROM sites');

  const sitesWithCalc = await Promise.all(
    sites.map(async site => {
      const result = await calculateSiteProfit({
        numMachines: site.num_machines,
        powerRate: site.power_rate
      });
      return { ...site, ...result };
    })
  );

  const networkHashrateTH =
    sitesWithCalc.length > 0 ? sitesWithCalc[0].network_hashrate : 'N/A';

  res.render('index', {
    sites: sitesWithCalc,
    networkHashrateTH,
    updatedTime: new Date().toLocaleString()
  });
};

export const getSitePage = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const location = req.params.location;

  // 从数据库取出指定 name 的站点
  const siteFromDB: Site | undefined = await db.get(
    'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
    location
  );

  if (!siteFromDB) {
    // 这里不 return res...，而是 send + return 一个空值，确保函数返回 Promise<void>
    res.status(404).send('Site not found');
    return;
  }

  // 计算该站点的收益数据
  const result = await calculateSiteProfit({
    numMachines: siteFromDB.num_machines,
    powerRate: siteFromDB.power_rate
  });

  const site = { ...siteFromDB, ...result };
  const networkHashrateTH = result.network_hashrate;
  const updatedTime = new Date().toLocaleString();

  res.render('site', {
    site,
    networkHashrateTH,
    updatedTime
  });
};

export const postAddSite = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;
  const { name, num_machines, machine_type, power_rate } = req.body;

  await db.run(
    'INSERT INTO sites (name, num_machines, machine_type, power_rate) VALUES (?, ?, ?, ?)',
    [name, num_machines, machine_type, power_rate]
  );

  res.redirect('/');
};

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

  const siteFromDB: Site | undefined = await db.get(
    'SELECT * FROM sites WHERE name = ? COLLATE NOCASE',
    location
  );

  if (!siteFromDB) {
    res.status(404).send('Site not found');
    return;
  }

  const result = await calculateSiteProfit({
    numMachines: siteFromDB.num_machines,
    powerRate: siteFromDB.power_rate
  });

  const site = { ...siteFromDB, ...result };
  res.render('site', {
    site,
    networkHashrateTH: result.network_hashrate,
    updatedTime: new Date().toLocaleString()
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

export const postUpdateSite = async (req: Request, res: Response): Promise<void> => {
  const db = req.app.locals.db;

  // 1) 拿到当前用户并断言
  const user = req.user as {
    id: number;
    username: string;
    role: 'admin' | 'user';
    location?: string | null;
  };

  const locationParam = req.params.location;
  const { num_machines, power_rate } = req.body;

  // 2) 再次校验：普通用户只能修改自己站点
  // if (user.role === 'user' && user.location?.toLowerCase() !== locationParam) {
  //   res.status(403).send('Unauthorized Access');
  //   return;
  // }

  // 3) 确认站点存在
  const siteExists = await db.get(
    'SELECT 1 FROM sites WHERE name = ? COLLATE NOCASE',
    locationParam
  );
  if (!siteExists) {
    res.status(404).send('Site not found');
    return;
  }

  // 4) 执行更新
  await db.run(
    `UPDATE sites
       SET num_machines = ?, power_rate = ?
     WHERE name = ? COLLATE NOCASE`,
    num_machines,
    power_rate,
    locationParam
  );

  // 5) 跳回该站点页面
  res.redirect(`/site/${locationParam}`);
};

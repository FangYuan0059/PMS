import { Router } from 'express';
import { getIndexPage, postAddSite } from '../controllers/siteController';


const router = Router();

router.get('/', getIndexPage);
router.post('/add-site', postAddSite);

export default router;

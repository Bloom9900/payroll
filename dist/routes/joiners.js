import { Router } from 'express';
import { createJoiner, fetchWorkdayJoinerStub, getUpcomingJoiners } from '../services/joiners.js';
export const joinersRouter = Router();
joinersRouter.get('/upcoming', (req, res) => {
    try {
        const { month } = req.query;
        const joiners = getUpcomingJoiners(month);
        const payload = joiners.map(j => ({
            employeeId: j.id,
            name: `${j.firstName} ${j.lastName}`,
            startDate: j.startDate,
            department: j.department,
            role: j.role,
            location: j.location,
            contractType: j.contractType,
            isThirtyPercentRuling: j.isThirtyPercentRuling
        }));
        res.json({
            month: month ?? null,
            count: payload.length,
            employees: payload
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
joinersRouter.get('/workday/:workerId', (req, res) => {
    const data = fetchWorkdayJoinerStub(req.params.workerId);
    res.json({
        workerId: req.params.workerId,
        stub: data,
        message: 'Replace with real Workday API call once available'
    });
});
joinersRouter.post('/', (req, res) => {
    try {
        const plan = createJoiner(req.body);
        res.status(201).json(plan);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});

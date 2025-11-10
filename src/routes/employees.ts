import { Router } from 'express'
import { employees } from '../data/dummy.js'

export const employeesRouter = Router()

employeesRouter.get('/', (_req, res) => {
  res.json(employees)
})

employeesRouter.get('/:id', (req, res) => {
  const e = employees.find(x => x.id === req.params.id)
  if (!e) return res.status(404).json({ error: 'Not found' })
  res.json(e)
})

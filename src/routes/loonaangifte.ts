import { Router } from 'express'
import {
  createFilingBatch,
  generateFilingDocuments,
  getFilingBatch,
  listFilingBatches,
  getFilingDocuments,
  generateFilingZip,
  generateEmployeeLoonaangifte,
  validateLoonaangifteXML
} from '../services/loonaangifte.js'
import type { DetailedPayrollResult } from '../models/payroll.js'

export const loonaangifteRouter = Router()

// Create filing batch
loonaangifteRouter.post('/batches', (req, res) => {
  try {
    const { period, createdBy } = req.body
    if (!period || !createdBy) {
      return res.status(400).json({ error: 'Period and createdBy are required' })
    }
    
    const batch = createFilingBatch(period, createdBy)
    res.json({ batch })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// List filing batches
loonaangifteRouter.get('/batches', (req, res) => {
  try {
    const batches = listFilingBatches()
    res.json({ batches })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get filing batch
loonaangifteRouter.get('/batches/:id', (req, res) => {
  try {
    const batch = getFilingBatch(req.params.id)
    if (!batch) {
      return res.status(404).json({ error: 'Filing batch not found' })
    }
    
    const documents = getFilingDocuments(batch.id)
    res.json({
      batch,
      documents,
      validationReport: JSON.parse(batch.validationReportJson)
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Generate filing documents
loonaangifteRouter.post('/batches/:id/generate', (req, res) => {
  try {
    const batch = getFilingBatch(req.params.id)
    if (!batch) {
      return res.status(404).json({ error: 'Filing batch not found' })
    }
    
    const { calculations } = req.body as { calculations: Array<{ employeeId: string; calculation: DetailedPayrollResult }> }
    if (!calculations || !Array.isArray(calculations)) {
      return res.status(400).json({ error: 'Calculations array is required' })
    }
    
    const documents = generateFilingDocuments(batch.id, calculations)
    const batchUpdated = getFilingBatch(batch.id)
    
    res.json({
      batch: batchUpdated,
      documents,
      validationReport: JSON.parse(batchUpdated!.validationReportJson)
    })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Get filing documents
loonaangifteRouter.get('/batches/:id/documents', (req, res) => {
  try {
    const documents = getFilingDocuments(req.params.id)
    res.json({ documents })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Generate ZIP file
loonaangifteRouter.post('/batches/:id/zip', (req, res) => {
  try {
    const zipInfo = generateFilingZip(req.params.id)
    res.json(zipInfo)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Generate single employee XML
loonaangifteRouter.post('/generate', (req, res) => {
  try {
    const { employeeId, period, calculation } = req.body as {
      employeeId: string
      period: string
      calculation: DetailedPayrollResult
    }
    
    if (!employeeId || !period || !calculation) {
      return res.status(400).json({ error: 'employeeId, period, and calculation are required' })
    }
    
    const xml = generateEmployeeLoonaangifte(employeeId, period, calculation)
    const validation = validateLoonaangifteXML(xml)
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.send(xml)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Validate XML
loonaangifteRouter.post('/validate', (req, res) => {
  try {
    const { xml } = req.body
    if (!xml) {
      return res.status(400).json({ error: 'XML is required' })
    }
    
    const validation = validateLoonaangifteXML(xml)
    res.json(validation)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})


export type DummyEmployee = {
  id: string
  firstName: string
  lastName: string
  email: string
  startDate: string
  endDate?: string | null
  iban: string
  bic?: string | null
  annualSalaryCents: number
  hoursPerWeek: number
  isThirtyPercentRuling: boolean
  holidayAllowanceEligible: boolean
  holidayDaysPerYear: number
  usedHolidayDaysYtd: number
}

export const employees: DummyEmployee[] = [
  {
    id: 'E-10001',
    firstName: 'Ava',
    lastName: 'Jansen',
    email: 'ava.jansen@example.com',
    startDate: '2024-02-01',
    endDate: null,
    iban: 'NL91ABNA0417164300',
    bic: 'ABNANL2A',
    annualSalaryCents: 6000000,
    hoursPerWeek: 40,
    isThirtyPercentRuling: false,
    holidayAllowanceEligible: true,
    holidayDaysPerYear: 25,
    usedHolidayDaysYtd: 12
  },
  {
    id: 'E-10002',
    firstName: 'Noah',
    lastName: 'de Vries',
    email: 'noah.devries@example.com',
    startDate: '2023-10-15',
    endDate: null,
    iban: 'NL02RABO0134567890',
    bic: 'RABONL2U',
    annualSalaryCents: 8400000,
    hoursPerWeek: 36,
    isThirtyPercentRuling: true,
    holidayAllowanceEligible: true,
    holidayDaysPerYear: 28,
    usedHolidayDaysYtd: 8
  },
  {
    id: 'E-10003',
    firstName: 'Sofie',
    lastName: 'van Dijk',
    email: 'sofie.vandijk@example.com',
    startDate: '2025-01-10',
    endDate: null,
    iban: 'NL55INGB0001234567',
    bic: 'INGBNL2A',
    annualSalaryCents: 4800000,
    hoursPerWeek: 32,
    isThirtyPercentRuling: false,
    holidayAllowanceEligible: true,
    holidayDaysPerYear: 24,
    usedHolidayDaysYtd: 5
  }
]

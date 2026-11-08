import {customerWorkbook,sampleExport} from '@/lib/excel';
export async function GET(){return new Response(await customerWorkbook(sampleExport),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="RAMSON-SAMPLE-customers.xlsx"','Cache-Control':'no-store'}})}

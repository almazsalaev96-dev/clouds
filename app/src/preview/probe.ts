import pack from '../../server/packs/9609.json'
// @ts-expect-error — plain JS modules, no types
import { parseScheme } from '../../server/marking/scheme.js'
// @ts-expect-error
import { mark } from '../../server/marking/marker.js'
// @ts-expect-error
import { mock } from '../../server/providers/mock.js'

const out = document.getElementById('out')!
const item = (pack as any).items.find((i: any) => i.id === 'itm_9609_p2_10')
const scheme = parseScheme((pack as any).schemes.find((s: any) => s.id === item.scheme_id))
const answer = 'One benefit is that Solara can compare actual spend with the plan in each of its three countries, '
  + 'so it spots the market that is overspending early. A second benefit is that each country manager is '
  + 'accountable for their own budget, which motivates them to control costs.'
mark({ item, scheme, answer, provider: mock, model: 'mock' })
  .then((m: any) => {
    out.textContent = `total ${JSON.stringify(m.total_band)}\n`
      + (m.per_point || []).map((p: any) => `${p.marking_point_id} ${p.awarded}/${p.max} ${JSON.stringify(p.quote?.slice(0, 50))}`).join('\n')
  })
  .catch((e: Error) => { out.textContent = 'FAILED: ' + e.message + '\n' + e.stack })

import { LifeBuoy, Plus } from 'lucide-react';
import { navigate, setQuery, useRoute } from '../../app/router';
import { Page, Segmented } from '../../ui/components';
import { openHardDay } from '../today/Today';
import { LettersTab } from './Letters';
import { RepertoireTab } from './Repertoire';
import { SituationsTab } from './Situations';

export function GuideHome() {
  const route = useRoute();
  const tab = (route.query.get('t') as 'repertorio' | 'situacoes' | 'cartas') || 'repertorio';
  const addTarget = tab === 'cartas' ? '/guia/carta/nova' : tab === 'repertorio' ? `/guia/item/novo?tipo=${route.query.get('k') || 'resource'}` : null;
  return (
    <Page
      title="Guia"
      ghost="cuidar"
      subtitle="Como cuidar de si com o que você já sabe."
      actions={
        <>
          <button className="btn ghost sm" onClick={openHardDay}>
            <LifeBuoy size={16} /> Dia difícil
          </button>
          {addTarget && (
            <button className="icon-btn filled" aria-label="Adicionar" onClick={() => navigate(addTarget)}>
              <Plus size={22} />
            </button>
          )}
        </>
      }
    >
      <Segmented
        ariaLabel="Seção do guia"
        value={tab}
        onChange={(t) => setQuery('t', t)}
        options={[
          { value: 'repertorio', label: 'Repertório' },
          { value: 'situacoes', label: 'Situações' },
          { value: 'cartas', label: 'Cartas' },
        ]}
      />
      {tab === 'repertorio' && <RepertoireTab />}
      {tab === 'situacoes' && <SituationsTab />}
      {tab === 'cartas' && <LettersTab />}
    </Page>
  );
}

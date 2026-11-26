import { ChevronRight, Heart, LifeBuoy, Plus } from 'lucide-react';
import { navigate, setQuery, useRoute } from '../../app/router';
import { Page, Segmented } from '../../ui/components';
import { openHardDay } from '../today/Today';
import { LettersTab } from './Letters';
import { RepertoireTab } from './Repertoire';
import { SituationsTab } from './Situations';
import { CareTab } from '../care/Care';

export function GuideHome() {
  const route = useRoute();
  const tab = (route.query.get('t') as 'repertorio' | 'situacoes' | 'cartas' | 'acompanhamento') || 'repertorio';
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
          { value: 'acompanhamento', label: 'Consultas' },
        ]}
      />
      {tab === 'repertorio' && (
        <button className="card row" style={{ marginTop: 16 }} onClick={() => navigate('/guia/emocoes')}>
          <Heart size={20} />
          <div className="grow">
            <div className="h3">Minhas emoções</div>
            <div className="small muted">Como cada uma aparece em você, o que vem junto e o que ajuda a lidar com ela.</div>
          </div>
          <ChevronRight className="chev" size={18} />
        </button>
      )}
      {tab === 'repertorio' && <RepertoireTab />}
      {tab === 'situacoes' && <SituationsTab />}
      {tab === 'cartas' && <LettersTab />}
      {tab === 'acompanhamento' && <CareTab />}
    </Page>
  );
}

"""Authenticated data battery. Usage: HOMI_QA_SESSION_FILE=... python3 scripts/homi/test-dossie.py.
Fixtures are test-only f2050000 UUIDs; never write real clients. Session is never printed.
"""
import json,os,re,requests,uuid
from pathlib import Path
session=json.loads(Path(os.environ['HOMI_QA_SESSION_FILE']).read_text())
env=Path('.env').read_text(); url=re.search(r'VITE_SUPABASE_URL="?([^"\n]+)',env).group(1);key=re.search(r'VITE_SUPABASE_PUBLISHABLE_KEY="?([^"\n]+)',env).group(1)
headers={'apikey':key,'Authorization':'Bearer '+session['access_token']}
count=0

def check(ok,label):
 global count
 assert ok,label
 count+=1;print('PASS',label)
def rpc(name,body):return requests.post(url+'/rest/v1/rpc/'+name,headers=headers,json=body,timeout=30)
def read(table,params):
 r=requests.get(url+'/rest/v1/'+table,headers=headers,params=params,timeout=30);assert r.ok,(table,r.status_code);return r.json()
uid=session['user']['id']
check(not any(x['role']=='admin' for x in read('user_roles',{'user_id':'eq.'+uid,'select':'role'})),'sessão de corretor, não admin')
for n in range(1,9):
 lead='f2050000-0000-4000-8000-'+str(n).zfill(12)
 r=rpc('homi_dossie_lead',{'p_lead':lead});check(r.ok,f'dossiê QA {n} autorizado');d=r.json()
 Path('/tmp/browser/homi-passo2/dossie-'+str(n)+'.json').write_text(json.dumps(d,ensure_ascii=False))
 check(all(b.get('status') in ['ok','vazio','indisponível'] for k,b in d.items() if isinstance(b,dict) and 'dados' in b),f'status explícitos QA {n}')
 check(d['qualificacao']['dados']['radar_quartos']==3 and d['qualificacao']['dados']['prazo_decisao']=='até março',f'qualificação preservada QA {n}')
 l=read('pipeline_leads',{'id':'eq.'+lead,'select':'ultimo_toque_at,distribuido_em,aceito_em,stage_id'})[0]
 st=read('pipeline_stages',{'id':'eq.'+l['stage_id'],'select':'tipo'})[0]
 ref=max(x for x in [l['distribuido_em'],l['aceito_em']] if x)
 health=rpc('lead_saude_status',{'p_ultimo_toque':l['ultimo_toque_at'],'p_ref':ref,'p_stage_tipo':st['tipo']})
 check(health.ok and health.json()==d['lead']['dados']['saude'],f'saúde igual à função do banco QA {n}')
 if n==1:
  acts=read('pipeline_atividades',{'pipeline_lead_id':'eq.'+lead,'select':'id,titulo,descricao,resultado','order':'created_at.desc,id.desc'})
  check(len(d['atividades_recentes']['dados'])==8,'oito atividades integrais')
  check([a['id'] for a in d['atividades_recentes']['dados']]==[a['id'] for a in acts[:8]],'oito mais recentes iguais ao banco')
  check(all(a['descricao']==next(x['descricao'] for x in acts if x['id']==a['id']) for a in d['atividades_recentes']['dados']),'descrições integrais sem corte')
  check(d['timeline']['dados']['total']==len(acts),'timeline inteira contada')
  check(sum(d['timeline']['dados']['por_tipo'].values())==len(acts),'contagens por tipo sem duplicação')
  notes=read('pipeline_anotacoes',{'pipeline_lead_id':'eq.'+lead,'select':'id,conteudo,fixada','order':'created_at.desc,id.desc'})
  check(set(a['id'] for a in notes[:5]).issubset(set(a['id'] for a in d['anotacoes']['dados'])),'cinco anotações mais recentes preservadas')
  check(any(a['fixada'] for a in d['anotacoes']['dados']),'fixada antiga não apaga recente')
  check(d['lia_conversas']['status']=='ok','Lia por telefone 12 vs 11 dígitos')
 if n in (1,2,3):
  visits=read('visitas',{'pipeline_lead_id':'eq.'+lead,'select':'id,status,resultado_visita,objecao,confirmed_at'})
  check(len(d['visitas']['dados'])==len(visits),'visitas iguais ao banco QA '+str(n))
  check(all(x['resultado_visita']==next(v['resultado_visita'] for v in visits if v['id']==x['id']) for x in d['visitas']['dados']),'resultados integrais QA '+str(n))
  if n==1:check(any(v['status']=='no_show' and v['confirmed_at'] for v in visits),'no-show com confirmação anterior')
  if n==2:check(any(v['status']=='marcada' for v in visits),'visita amanhã marcada')
  if n==3:check(any(v['objecao']=='Valor do condomínio' for v in visits),'objeção pós-visita registrada')
 changes=read('pipeline_historico',{'pipeline_lead_id':'eq.'+lead,'select':'id'})
 check(len(d['mudancas_etapa']['dados'] or [])==len(changes),'mudanças de etapa com data/fonte QA '+str(n))
 if n==4:
  check(d['lia_estado']['dados'][0]['resumo']=='Busca casa 3 dormitórios até março.','Lia pelo lead_id')
  check(d['lia_conversas']['dados']['mensagens_nao_lidas'] is True,'mensagens Lia só sem resumo')
 if n==6:check(d['whatsapp_respostas']['dados'][0]['mensagem']=='QA casas com pátio','disparo por telefone 13 vs 11 dígitos')
 if n==7:
  check(d['parceria']['status']=='ok' and d['lead']['dados']['corretor_id']!=uid,'parceria dá acesso sem posse')
  check(d['negocios']['dados'][0]['vgv_estimado']==700000,'negócio em parceria legível')
 if n==8:
  check(d['lead']['dados']['reaproveitado_em'] is not None,'lead vindo do Bolsão')
  check([x['feedback'] for x in d['oferta_ativa']['dados']]==['QA atual: retorno amanhã'],'feedback OA anterior oculto')
  check(any(m['outro_corretor'] is True and m['autor'] and m['data'] for m in d['memoria']['dados']),'memória anterior marcada com autor/data')
  requests.delete(url+'/rest/v1/homi_memoria_lead',headers=headers,params={'lead_id':'eq.'+lead,'user_id':'eq.'+uid},timeout=30).raise_for_status()
  before=read('homi_memoria_lead',{'lead_id':'eq.'+lead,'select':'id'})
  r=rpc('homi_memoria_confirmar',{'p_lead':lead,'p_chave':'decisor','p_valor':'decide com cônjuge','p_confirmado':False})
  check(not r.ok and len(read('homi_memoria_lead',{'lead_id':'eq.'+lead,'select':'id'}))==len(before),'sem confirmação não grava')
  r=rpc('homi_memoria_confirmar',{'p_lead':lead,'p_chave':'decisor','p_valor':'decide com cônjuge','p_confirmado':True});check(r.ok,'memória confirmada grava')
  after=read('homi_memoria_lead',{'lead_id':'eq.'+lead,'select':'id,user_id,valor'});check(len(after)==len(before)+1,'mesmo assunto por dois autores sem conflito')
  r2=rpc('homi_memoria_confirmar',{'p_lead':lead,'p_chave':'decisor','p_valor':'decide com cônjuge','p_confirmado':True});check(r2.ok and r2.json()==r.json(),'memória idempotente por autor')
  r=rpc('homi_memoria_confirmar',{'p_lead':lead,'p_chave':'observacao','p_valor':'CPF 12345678901','p_confirmado':True});check(not r.ok,'memória recusa dados pessoais')
r=rpc('homi_dossie_lead',{'p_lead':str(uuid.uuid4())});check(not r.ok and 'sem acesso' in r.text,'lead fora do escopo recusado')
r=requests.post(url+'/rest/v1/rpc/homi_dossie_lead',headers={'apikey':key,'Authorization':'Bearer '+key},json={'p_lead':'f2050000-0000-4000-8000-000000000001'},timeout=30);check(not r.ok,'anon sem EXECUTE')
check(read('system_flags',{'flag_name':'eq.homi_dossie_ativo','select':'flag_value'})[0]['flag_value'] is False,'dossiê permanece desligado')
print('TOTAL',count,'PASS')

"use client";

import { useState } from 'react';
import { sellingRequest, type OlxSettings } from '@/lib/selling';

type Option = { id: number; name: string; county?: string; is_leaf?: boolean; parent_id?: number };
type Attribute = { code: string; label: string; values?: { code: string; label: string }[]; validation?: { required?: boolean; numeric?: boolean; type?: string; min?: number; max?: number; allow_multiple_values?: boolean } };
const field = 'mt-1 w-full border border-[#101010]/40 bg-white p-2 text-sm';
const button = 'border border-[#101010] px-3 py-2 text-xs font-bold hover:bg-[#FF4F8B] disabled:opacity-40';

export function OlxPublishingSettings({ value, onChange }: { value: OlxSettings; onChange: (value: OlxSettings) => void }) {
  const [categories, setCategories] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [moreCities, setMoreCities] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'Catalogul nu este disponibil.'); } finally { setBusy(false); } }
  function updateAttribute(attribute: Attribute, raw: string | string[]) {
    const entry = Array.isArray(raw) ? { code: attribute.code, values: raw } : { code: attribute.code, value: attribute.validation?.numeric ? Number(raw) : raw };
    onChange({ ...value, attributes: [...value.attributes.filter((item) => item.code !== attribute.code), ...(raw.length ? [entry] : [])] });
  }
  const filteredCategories = categories.filter((item) => item.is_leaf !== false && item.name.toLocaleLowerCase('ro').includes(categorySearch.toLocaleLowerCase('ro')));
  const filteredCities = cities.filter((item) => `${item.name} ${item.county || ''}`.toLocaleLowerCase('ro').includes(citySearch.toLocaleLowerCase('ro')));
  return <div className="mt-4 space-y-4 border-t border-black/20 pt-4">
    <p className="text-sm font-bold">Detalii cerute de OLX</p>
    <button type="button" className={button} disabled={busy} onClick={() => run(async () => {
      const [categoryResult, cityResult] = await Promise.all([sellingRequest('/olx/catalog?kind=categories'), sellingRequest('/olx/catalog?kind=cities&offset=0')]);
      setCategories(categoryResult.items); setCities(cityResult.items); setOffset(cityResult.items.length); setMoreCities(cityResult.items.length === 1000);
      if (value.categoryId) setAttributes((await sellingRequest(`/olx/catalog?kind=attributes&category=${value.categoryId}`)).items);
      if (value.cityId) setDistricts((await sellingRequest(`/olx/catalog?kind=districts&city=${value.cityId}`)).items);
    })}>{busy ? 'Se încarcă…' : 'Încarcă opțiunile din OLX'}</button>
    {categories.length > 0 && <>
      <label className="block text-xs">Caută categoria<input className={field} value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} /></label>
      <label className="block text-xs">Categoria OLX<select disabled={busy} className={field} value={value.categoryId || ''} onChange={(event) => { const id = Number(event.target.value); onChange({ ...value, categoryId: id, attributes: [] }); setAttributes([]); if (id) run(async () => setAttributes((await sellingRequest(`/olx/catalog?kind=attributes&category=${id}`)).items)); }}><option value="">Alege categoria</option>{filteredCategories.map((item) => <option key={item.id} value={item.id}>{categories.find((parent) => parent.id === item.parent_id)?.name} / {item.name}</option>)}</select></label>
      <label className="block text-xs">Caută localitatea<input className={field} value={citySearch} onChange={(event) => setCitySearch(event.target.value)} /></label>
      <label className="block text-xs">Localitatea OLX<select disabled={busy} className={field} value={value.cityId || ''} onChange={(event) => { const id = Number(event.target.value); onChange({ ...value, cityId: id, districtId: undefined }); setDistricts([]); if (id) run(async () => setDistricts((await sellingRequest(`/olx/catalog?kind=districts&city=${id}`)).items)); }}><option value="">Alege localitatea</option>{filteredCities.map((item) => <option key={item.id} value={item.id}>{item.name}{item.county ? `, ${item.county}` : ''}</option>)}</select></label>
      {moreCities && <button type="button" disabled={busy} className={button} onClick={() => run(async () => { const result = await sellingRequest(`/olx/catalog?kind=cities&offset=${offset}`); setCities((current) => [...current, ...result.items]); setOffset(offset + result.items.length); setMoreCities(result.items.length === 1000); })}>Încarcă mai multe localități</button>}
      {districts.length > 0 && <label className="block text-xs">Sector / cartier<select className={field} value={value.districtId || ''} onChange={(event) => onChange({ ...value, districtId: Number(event.target.value) || undefined })}><option value="">Alege, dacă este necesar</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </>}
    <label className="block text-xs">Tip vânzător<select className={field} value={value.advertiserType} onChange={(event) => onChange({ ...value, advertiserType: event.target.value })}><option value="private">Persoană fizică</option><option value="business">Firmă</option></select></label>
    {attributes.filter((attribute) => !['price', 'salary'].includes(attribute.code)).map((attribute) => {
      const current = value.attributes.find((item) => item.code === attribute.code);
      return <label key={attribute.code} className="block text-xs">{attribute.label}{attribute.validation?.required ? ' *' : ''}{attribute.values?.length ? <select className={field} multiple={attribute.validation?.allow_multiple_values} value={attribute.validation?.allow_multiple_values ? current?.values || [] : String(current?.value ?? '')} onChange={(event) => updateAttribute(attribute, attribute.validation?.allow_multiple_values ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value)}>{!attribute.validation?.allow_multiple_values && <option value="">Alege</option>}{attribute.values.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select> : <input className={field} type={attribute.validation?.numeric ? 'number' : 'text'} value={String(current?.value ?? '')} onChange={(event) => updateAttribute(attribute, event.target.value)} />}</label>;
    })}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}

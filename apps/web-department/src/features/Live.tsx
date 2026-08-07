import { useDistricts, useQuarries } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { FilterSelect, LivePanel, localizedName, PageHeader, useAuth } from '@karier/ui';
import { useMemo, useState } from 'react';

/**
 * Viloyatdagi istalgan karyerni jonli ko'rish.
 *
 * Karyer ilovasidan farqi faqat shunda: operatorda bitta karyer bor, inspektor
 * esa tanlaydi. Ro'yxat o'z viloyati bilan cheklanadi — server ham shunday
 * cheklaydi, ya'ni begona karyer tanlansa 403 kelardi va sahifa sababsiz
 * bo'sh ko'rinardi.
 *
 * Bir viloyatda o'nlab karyer bo'ladi va har birida bir nechta kamera, ya'ni
 * bitta ro'yxatga sig'maydigan miqdorda. Shuning uchun tanlov ikki bosqichli:
 * avval tuman, keyin o'sha tumandagi karyer. Ekranda esa hamisha bitta
 * karyerning kameralari turadi — ular jonli oqim, va o'ttiztasini birdan
 * ochish kanalni ham, brauzerni ham bo'g'adi.
 */
export function Live() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: quarries } = useQuarries();
  const { data: districts } = useDistricts(user?.region_id ?? undefined);

  const [district, setDistrict] = useState('');
  const [picked, setPicked] = useState('');

  const districtOptions = useMemo(
    () =>
      [...(districts ?? [])]
        .sort((a, b) => localizedName(a).localeCompare(localizedName(b)))
        .map((d): [string, string] => [d.id, localizedName(d)]),
    [districts],
  );

  // Tumanlar ro'yxati allaqachon viloyat bo'yicha kelgani uchun karyerlarni
  // ham shu ro'yxat bilan filtrlaymiz — /quarries hammasini qaytaradi.
  const options = useMemo(() => {
    const mine = new Set((districts ?? []).map((d) => d.id));
    return [...(quarries ?? [])]
      .filter((q) => (district ? q.district_id === district : mine.has(q.district_id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [quarries, districts, district]);

  // Tanlangani ro'yxatdan tushib qolsa (tuman almashdi) — birinchisi, ya'ni
  // sahifa hech qachon sababsiz bo'sh turmaydi.
  const quarryId = options.some((q) => q.id === picked) ? picked : options[0]?.id;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_live')}
        subtitle={t('live_subtitle_dept')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[180px]">
              <FilterSelect
                label={t('dash_district')}
                value={district}
                onChange={setDistrict}
                options={districtOptions}
              />
            </div>
            <div className="w-[220px]">
              <FilterSelect
                label={t('q_name')}
                value={quarryId ?? ''}
                onChange={setPicked}
                options={options.map((q): [string, string] => [q.id, q.name])}
                allowAll={false}
              />
            </div>
          </div>
        }
      />
      <LivePanel quarryId={quarryId} />
    </div>
  );
}

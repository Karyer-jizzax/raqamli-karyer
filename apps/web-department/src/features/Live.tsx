import { useDistricts, useQuarries, useQuarriesLive, useRegions } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Button, FilterSelect, LivePanel, localizedName, PageHeader, useAuth } from '@karier/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Viloyatdagi istalgan karyerni jonli ko'rish.
 *
 * Karyer ilovasidan farqi faqat shunda: operatorda bitta karyer bor, inspektor
 * esa tanlaydi. Ro'yxat o'z viloyati bilan cheklanadi — server ham shunday
 * cheklaydi, ya'ni begona karyer tanlansa 403 kelardi va sahifa sababsiz
 * bo'sh ko'rinardi.
 *
 * Bir viloyatda o'nlab karyer bo'ladi va har birida bir nechta kamera, ya'ni
 * bitta ro'yxatga sig'maydigan miqdorda. Shuning uchun tanlov bosqichma-bosqich
 * toraytiriladi: viloyat → tuman → karyer. Ekranda esa hamisha bitta
 * karyerning kameralari turadi — ular jonli oqim, va o'ttiztasini birdan
 * ochish kanalni ham, brauzerni ham bo'g'adi. Qaysi kameralar ko'rinishi va
 * devor necha ustun bo'lishi shu yerdan emas, `LivePanel` ichidan tanlanadi —
 * u ikkala ilovada bir xil.
 *
 * Viloyat tanlagichi faqat superadminda: departament foydalanuvchisi o'z
 * viloyatiga bog'langan va unga bitta variantli ro'yxat ko'rsatish — bosishga
 * hech nima bermaydigan boshqaruv.
 *
 * Nima uchun karyerlarning jonli holati ham yuklanadi: sahifa ilgari alifbo
 * bo'yicha birinchi karyerni ochardi va agar aynan o'shanda oqim bo'lmasa,
 * ekranda "jonli ko'rinish yo'q" turardi — qo'shni karyerda kamera bemalol
 * ishlayotgan bo'lsa ham. Inspektor esa bundan "tizimda kamera yo'q" degan
 * xulosa chiqarardi. Endi tanlagichda har bir karyerning holati ko'rinadi va
 * standart tanlov tirik karyerga tushadi.
 */
export function Live() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: quarries } = useQuarries();
  const { data: regions } = useRegions();

  const locked = user?.region_id ?? '';
  // Tumanga bog'langan hisobda tuman tanlagichi ham ortiqcha: server bitta
  // tumanning karyerlarini qaytaradi, tanlashga variant qolmaydi.
  const lockedDistrict = user?.district_id ?? '';
  const [region, setRegion] = useState('');
  const [pickedDistrict, setPickedDistrict] = useState('');
  const district = lockedDistrict || pickedDistrict;
  const [picked, setPicked] = useState('');

  const { data: districts } = useDistricts(locked || region || undefined);
  const { data: live } = useQuarriesLive();

  // Karyer sahifasidagi "Jonli ko'rish" shu yerga `?quarry=<id>` bilan keladi.
  const [params, setParams] = useSearchParams();
  const requested = params.get('quarry') ?? '';

  // Karyer → holat. Ro'yxat 30 soniyada yangilanadi, shuning uchun xarita
  // har safar qayta yig'iladi — muzlagan holat ko'rsatgandan ko'ra arzon.
  const liveById = useMemo(() => new Map((live ?? []).map((r) => [r.quarry_id, r])), [live]);
  const hasLive = useCallback(
    (id: string) => {
      const row = liveById.get(id);
      return !!row && row.live_mode !== 'off' && row.cameras_total > 0;
    },
    [liveById],
  );

  const regionOptions = useMemo(
    () =>
      [...(regions ?? [])]
        .sort((a, b) => localizedName(a).localeCompare(localizedName(b)))
        .map((r): [string, string] => [r.id, localizedName(r)]),
    [regions],
  );

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
    const inScope = new Set((districts ?? []).map((d) => d.id));
    return [...(quarries ?? [])]
      .filter((q) => (district ? q.district_id === district : inScope.has(q.district_id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [quarries, districts, district]);

  // Tanlangani ro'yxatdan tushib qolsa (tuman almashdi) — oqimi borlarning
  // birinchisi, u ham bo'lmasa ro'yxatning birinchisi: sahifa hech qachon
  // sababsiz bo'sh turmaydi. Zaxira tanlov quyidagi effekt bilan bir xil
  // qoidada hisoblanadi, aks holda ekran avval o'lik karyerni ko'rsatib,
  // keyin tirigiga sakrardi.
  const fallback = options.find((q) => hasLive(q.id)) ?? options[0];
  // Havola bilan kelingan bo'lsa ekran o'sha karyerni kutadi: zaxira tanlovga
  // tushib ketsa, bir lahzaga boshqa karyerning oqimi ochilib yopilardi.
  const quarryId = options.some((q) => q.id === picked)
    ? picked
    : requested
      ? options.find((q) => q.id === requested)?.id
      : fallback?.id;

  // Standart tanlov — oqimi bor karyer. Effektning sharti yuqoridagi render
  // sharti bilan aynan bir xil: `picked` bir marta ro'yxatga tushgach effekt
  // darrov chiqib ketadi, ya'ni 30 soniyalik yangilanish foydalanuvchi qo'lda
  // tanlagan karyerni tortib olmaydi.
  useEffect(() => {
    // Havoladagi karyer hal bo'lmaguncha zaxira tanlov kutadi, aks holda u
    // so'ralgan karyerni ochilishiga ulgurmasidan almashtirib yuborardi.
    if (requested) return;
    if (options.some((q) => q.id === picked)) return;
    // Holatlar hali kelmagan bo'lsa kutamiz: shoshsak alifbodagi birinchisiga
    // yopishib qolamiz va butun ish behuda.
    if (live === undefined) return;
    if (fallback) setPicked(fallback.id);
  }, [options, live, picked, fallback, requested]);

  // Manzildagi karyer bir marta qo'llanadi va so'rov tozalanadi: qolsa,
  // tanlagichdan boshqasiga o'tilganda ham havola uni qaytarib tortardi.
  // Ro'yxat ikkala so'rovdan yig'iladi, shuning uchun ikkalasi kelguncha
  // "topilmadi" deb hisoblamaymiz.
  useEffect(() => {
    if (!requested) return;
    if (!quarries || !districts) return;
    if (options.some((q) => q.id === requested)) setPicked(requested);
    setParams({}, { replace: true });
  }, [requested, quarries, districts, options, setParams]);

  // Ochiq karyerda oqim bo'lmasa — qayerda borligini aytadigan ro'yxat.
  // Faqat birinchisi ishlatiladi, lekin sanog'i ham aytiladi: "yana bittasi
  // bor" bilan "yana o'ntasi bor" — boshqa-boshqa xabar.
  const otherLive = useMemo(
    () => options.filter((q) => q.id !== quarryId && hasLive(q.id)),
    [options, quarryId, hasLive],
  );
  const firstLive = otherLive[0];

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_live')}
        subtitle={t('live_subtitle_dept')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {!locked && (
              <div className="w-[180px]">
                <FilterSelect
                  label={t('dash_region')}
                  value={region}
                  onChange={(v) => {
                    setRegion(v);
                    // Boshqa viloyatning tumani tanlanib qolmasin.
                    setPickedDistrict('');
                  }}
                  options={regionOptions}
                />
              </div>
            )}
            {!lockedDistrict && (
              <div className="w-[180px]">
                <FilterSelect
                  label={t('dash_district')}
                  value={district}
                  onChange={setPickedDistrict}
                  options={districtOptions}
                />
              </div>
            )}
            <div className="w-[220px]">
              <FilterSelect
                label={t('q_name')}
                value={quarryId ?? ''}
                onChange={setPicked}
                // Holat yorlig'ining ichida: `FilterSelect` variantlari oddiy
                // satr va u uchala ilovadagi deyarli har bir filtr — bitta
                // ekran uchun uni kengaytirish narxi foydasidan katta.
                options={options.map((q): [string, string] => {
                  const row = liveById.get(q.id);
                  const dot = hasLive(q.id) ? '●' : '○';
                  const count = row?.cameras_total ? ` · ${row.cameras_total}` : '';
                  return [q.id, `${dot} ${q.name}${count}`];
                })}
                allowAll={false}
              />
            </div>
          </div>
        }
      />
      <LivePanel
        quarryId={quarryId}
        offHint={
          firstLive ? (
            <div className="grid justify-items-center gap-2">
              <span className="text-2xs text-muted-foreground">
                {t('live_other_quarries', { n: otherLive.length })}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPicked(firstLive.id)}>
                {t('live_go_first')}
              </Button>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

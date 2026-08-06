import { useDistricts, useQuarries } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import {
  LivePanel,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useAuth,
} from '@karier/ui';
import { useMemo, useState } from 'react';

/**
 * Viloyatdagi istalgan karyerni jonli ko'rish.
 *
 * Karyer ilovasidan farqi faqat shunda: operatorda bitta karyer bor, inspektor
 * esa tanlaydi. Ro'yxat o'z viloyati bilan cheklanadi — server ham shunday
 * cheklaydi, ya'ni begona karyer tanlansa 403 kelardi va sahifa sababsiz
 * bo'sh ko'rinardi.
 */
export function Live() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: quarries } = useQuarries();
  const { data: districts } = useDistricts();

  const options = useMemo(() => {
    const list = [...(quarries ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    if (!user?.region_id || !districts?.length) return list;
    const mine = new Set(
      districts.filter((d) => d.region_id === user.region_id).map((d) => d.id),
    );
    return list.filter((q) => mine.has(q.district_id));
  }, [quarries, districts, user?.region_id]);

  const [picked, setPicked] = useState('');
  // Tanlanmagan bo'lsa birinchisi — sahifa bo'sh ochilmasin.
  const quarryId = picked || options[0]?.id;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5 p-4 lg:p-6">
      <PageHeader
        eyebrow={t('sec_oversight')}
        title={t('nav_live')}
        subtitle={t('live_subtitle_dept')}
        actions={
          <Select value={quarryId ?? ''} onValueChange={setPicked}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('live_pick_quarry')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <LivePanel quarryId={quarryId} />
    </div>
  );
}

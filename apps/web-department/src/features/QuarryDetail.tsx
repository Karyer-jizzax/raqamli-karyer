import { useDistricts, useQuarries, useRegions } from '@karier/api-client';
import { useTranslation } from '@karier/i18n';
import { Breadcrumb, type Crumb, localizedName, QuarryOverview } from '@karier/ui';
import { useNavigate, useParams } from 'react-router-dom';

/** End of the drill-down: dashboard → district → this quarry. */
export function QuarryDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { districtId, quarryId } = useParams<{ districtId: string; quarryId: string }>();

  const { data: districts } = useDistricts();
  const { data: regions } = useRegions();
  const { data: quarries } = useQuarries();
  const quarry = quarries?.find((q) => q.id === quarryId);
  const district = districts?.find((d) => d.id === (quarry?.district_id ?? districtId));
  const region = regions?.find((r) => r.id === district?.region_id);

  const crumbs: Crumb[] = [
    { label: region ? localizedName(region) : t('region') },
    {
      label: district ? localizedName(district) : t('loading'),
      onClick: district ? () => navigate(`/dashboard/districts/${district.id}`) : undefined,
    },
    { label: quarry?.name ?? t('loading') },
  ];

  return (
    <QuarryOverview
      quarryId={quarryId}
      breadcrumb={<Breadcrumb items={crumbs} onHome={() => navigate('/dashboard')} />}
    />
  );
}

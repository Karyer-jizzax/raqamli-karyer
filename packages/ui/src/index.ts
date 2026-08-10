export { Button, Card, StatusPill, LangSwitcher } from './components';
export {
  CountPill,
  Eyebrow,
  Field,
  localizedName,
  ModalForm,
  ROW_ACTION,
  ROW_ACTION_DANGER,
  StatusDot,
  TH,
} from './primitives';
export {
  Chip,
  DIRECTION_TONE,
  M1_STATUS_TONE,
  SOURCE_TONE,
  TONE_CHIP,
  TONE_DOT,
  TONE_FILL,
  TONE_TEXT,
  TRIP_KIND_TONE,
  TRIP_STAGE_TONE,
  type Tone,
} from './status';
export {
  DataGrid,
  DataTable,
  EmptyState,
  ErrorState,
  GRID_CELL,
  GRID_CTR,
  GRID_NUM,
  GRID_ROW,
  GRID_TH,
  GRID_TH_SUB,
  TableSkeleton,
  Unit,
} from './data-table';
export {
  FilterBar,
  FilterDate,
  FilterSelect,
  FilterText,
  useFilterPanel,
} from './filters';
export {
  type DateRange,
  deltaPct,
  type Period,
  PeriodPicker,
  periodRange,
  previousPeriod,
} from './period';
export { AppShell, type NavEntry } from './app-shell';
export {
  BucketColumns,
  CHART_CONTEXT,
  CHART_SLOTS,
  ChartCard,
  ChartLegend,
  ChartTable,
  DonutChart,
  RankBars,
  type Segment,
  SplitBar,
  StatTile,
  TrendColumns,
  TrendLine,
} from './charts';
export { Breadcrumb, type Crumb, PageHeader, Tabs, UpdatedStamp } from './shell';
export { PlateBadge, classifyPlate, formatPlateNumber, type PlateKind } from './plate';
export { AuthProvider, RequireAuth, useAuth, ProfileMenu } from './auth';
export { JizzaxMap } from './map';
export { ProtocolDocument, ProtocolViewer } from './protocol';
export { exportM1ToExcel, type ExportM1Options } from './export-events';

// Data screens shared by web-department and web-quarry
export { AgentStatusStrip, LiveGrid, LivePanel } from './features/live-view';
export { M1Table } from './features/m1-table';
export { QuarryOverview } from './features/quarry-overview';
export { TripsTable } from './features/trips-table';

// shadcn/ui primitives + helpers
export { cn } from './lib/utils';
export { Button as UiButton, buttonVariants } from './ui/button';
export {
  Card as UiCard,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './ui/card';
export { Input, PasswordInput } from './ui/input';
export { Label } from './ui/label';
export { Badge, badgeVariants } from './ui/badge';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
} from './ui/select';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './ui/table';
export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  getPaginationRange,
} from './ui/pagination';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './ui/dropdown-menu';

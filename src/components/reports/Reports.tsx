import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  MapPin,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

interface CollectorPayments {
  collector_name: string;
  total_payments: number;
  payment_count: number;
}

interface CollectorSales {
  collector_name: string;
  total_sales: number;
  sales_count: number;
}

interface RouteStats {
  route_name: string;
  client_count: number;
  total_sales: number;
}

interface ClientsByCollector {
  collector_name: string;
  client_count: number;
}

interface LatePaymentStats {
  status: string;
  count: number;
  total_amount: number;
}

interface PaymentTrend {
  date: string;
  amount: number;
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

export default function Reports() {
  const { userData } = useAuth();
  // Fix: Use local date to avoid "tomorrow" issues in evening
  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);

  const [collectorPayments, setCollectorPayments] = useState<CollectorPayments[]>([]);
  const [collectorSales, setCollectorSales] = useState<CollectorSales[]>([]);
  const [routeStats, setRouteStats] = useState<RouteStats[]>([]);
  const [clientsByCollector, setClientsByCollector] = useState<ClientsByCollector[]>([]);
  const [latePaymentStats, setLatePaymentStats] = useState<LatePaymentStats[]>([]);
  const [paymentTrend, setPaymentTrend] = useState<PaymentTrend[]>([]);

  const paymentsChartRef = useRef<HTMLDivElement>(null);
  const salesChartRef = useRef<HTMLDivElement>(null);
  const routesChartRef = useRef<HTMLDivElement>(null);
  const clientsChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userData?.organization_id) {
      loadReports();
    }
  }, [userData]);

  const loadReports = async () => {
    if (!userData?.organization_id) return;
    setLoading(true);
    try {
      await Promise.all([
        loadCollectorPayments(),
        loadCollectorSales(),
        loadRouteStats(),
        loadClientsByCollector(),
        loadLatePaymentStats(),
        loadPaymentTrend(),
      ]);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollectorPayments = async () => {
    const { data: paymentsData, error } = await supabase
      .from('payments')
      .select('amount, total_amount, collector_id')
      .eq('organization_id', userData.organization_id)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .eq('status', 'completed');

    if (error) {
      console.error('Error loading payments:', error);
      setCollectorPayments([]);
      return;
    }

    const collectorIds = [...new Set(paymentsData?.map((p: any) => p.collector_id).filter(Boolean))];

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .in('id', collectorIds);

    const usersMap = new Map(usersData?.map((u: any) => [u.id, u.name]));

    const grouped = paymentsData?.reduce((acc: any, payment: any) => {
      const name = usersMap.get(payment.collector_id) || 'Sin Asignar';
      if (!acc[name]) {
        acc[name] = { collector_name: name, total_payments: 0, payment_count: 0 };
      }
      acc[name].total_payments += payment.total_amount || payment.amount || 0;
      acc[name].payment_count += 1;
      return acc;
    }, {});

    setCollectorPayments(Object.values(grouped || {}));
  };

  const loadCollectorSales = async () => {
    const { data: salesData, error } = await supabase
      .from('sales')
      .select('total_amount, created_by')
      .eq('organization_id', userData.organization_id)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .eq('status', 'active');

    if (error) {
      console.error('Error loading sales:', error);
      setCollectorSales([]);
      return;
    }

    const userIds = [...new Set(salesData?.map((s: any) => s.created_by).filter(Boolean))];

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    const usersMap = new Map(usersData?.map((u: any) => [u.id, u.name]));

    const grouped = salesData?.reduce((acc: any, sale: any) => {
      const name = usersMap.get(sale.created_by) || 'Sin Asignar';
      if (!acc[name]) {
        acc[name] = { collector_name: name, total_sales: 0, sales_count: 0 };
      }
      acc[name].total_sales += sale.total_amount || 0;
      acc[name].sales_count += 1;
      return acc;
    }, {});

    setCollectorSales(Object.values(grouped || {}));
  };

  const loadRouteStats = async () => {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        id,
        nombre_ruta,
        clients:clients(id),
        route_sales:clients(sales(total_amount))
      `)
      .eq('organization_id', userData.organization_id);

    if (error) throw error;

    const stats = data?.map((route: any) => ({
      route_name: route.nombre_ruta,
      client_count: route.clients?.length || 0,
      total_sales: route.route_sales?.reduce((sum: number, client: any) => {
        return sum + (client.sales?.reduce((s: number, sale: any) => s + (sale.total_amount || 0), 0) || 0);
      }, 0) || 0,
    })) || [];

    setRouteStats(stats);
  };

  const loadClientsByCollector = async () => {
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, route_id')
      .eq('organization_id', userData.organization_id);

    if (clientsError) {
      console.error('Error loading clients:', clientsError);
      setClientsByCollector([]);
      return;
    }

    const routeIds = [...new Set(clientsData?.map((c: any) => c.route_id).filter(Boolean))];

    const { data: routesData } = await supabase
      .from('routes')
      .select('id, cobrador_asignado')
      .in('id', routeIds);

    const collectorIds = [...new Set(routesData?.map((r: any) => r.cobrador_asignado).filter(Boolean))];

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .in('id', collectorIds);

    const usersMap = new Map(usersData?.map((u: any) => [u.id, u.name]));
    const routesMap = new Map(routesData?.map((r: any) => [r.id, r.cobrador_asignado]));

    const grouped = clientsData?.reduce((acc: any, client: any) => {
      const collectorId = routesMap.get(client.route_id);
      const name = collectorId ? usersMap.get(collectorId) || 'Sin Asignar' : 'Sin Asignar';
      if (!acc[name]) {
        acc[name] = { collector_name: name, client_count: 0 };
      }
      acc[name].client_count += 1;
      return acc;
    }, {});

    setClientsByCollector(Object.values(grouped || {}));
  };

  const loadLatePaymentStats = async () => {
    const { data, error } = await supabase
      .from('payment_schedule')
      .select(`
        status,
        amount,
        sale:sales!inner(organization_id)
      `)
      .eq('sale.organization_id', userData.organization_id)
      .lte('due_date', new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]);

    if (error) {
      console.error('Error loading late payments:', error);
      setLatePaymentStats([]);
      return;
    }

    const grouped = data?.reduce((acc: any, schedule: any) => {
      const status = schedule.status === 'pending' ? 'Atrasado' : schedule.status === 'paid' ? 'Pagado' : 'Otro';
      if (!acc[status]) {
        acc[status] = { status, count: 0, total_amount: 0 };
      }
      acc[status].count += 1;
      acc[status].total_amount += parseFloat(schedule.amount) || 0;
      return acc;
    }, {});

    setLatePaymentStats(Object.values(grouped || {}));
  };

  const loadPaymentTrend = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_date, total_amount, amount')
      .eq('organization_id', userData.organization_id)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .eq('status', 'completed')
      .order('payment_date');

    if (error) throw error;

    const grouped = data?.reduce((acc: any, payment: any) => {
      const date = payment.payment_date;
      if (!acc[date]) {
        acc[date] = { date, amount: 0 };
      }
      acc[date].amount += payment.total_amount || payment.amount || 0;
      return acc;
    }, {});

    setPaymentTrend(Object.values(grouped || {}));
  };

  const downloadChartAsImage = async (chartRef: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current);
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Error al descargar la imagen');
    }
  };

  const downloadChartAsPDF = async (chartRef: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  const downloadAsExcel = (data: any[], filename: string) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error al descargar el archivo Excel');
    }
  };

  const downloadCompletePDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;

      pdf.setFontSize(18);
      pdf.text('Reporte Completo de Cobranza', 105, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.text(`Período: ${startDate} - ${endDate}`, 105, yPosition, { align: 'center' });
      yPosition += 15;

      if (collectorPayments.length > 0) {
        pdf.setFontSize(14);
        pdf.text('Pagos por Cobrador', 14, yPosition);
        yPosition += 5;

        (pdf as any).autoTable({
          startY: yPosition,
          head: [['Cobrador', 'Total Pagos', 'Cantidad']],
          body: collectorPayments.map(cp => [
            cp.collector_name,
            `$${cp.total_payments.toFixed(2)}`,
            cp.payment_count,
          ]),
        });
        yPosition = (pdf as any).lastAutoTable.finalY + 15;
      }

      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      if (collectorSales.length > 0) {
        pdf.setFontSize(14);
        pdf.text('Ventas por Cobrador', 14, yPosition);
        yPosition += 5;

        (pdf as any).autoTable({
          startY: yPosition,
          head: [['Cobrador', 'Total Ventas', 'Cantidad']],
          body: collectorSales.map(cs => [
            cs.collector_name,
            `$${cs.total_sales.toFixed(2)}`,
            cs.sales_count,
          ]),
        });
        yPosition = (pdf as any).lastAutoTable.finalY + 15;
      }

      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      if (routeStats.length > 0) {
        pdf.setFontSize(14);
        pdf.text('Estadísticas por Ruta', 14, yPosition);
        yPosition += 5;

        (pdf as any).autoTable({
          startY: yPosition,
          head: [['Ruta', 'Clientes', 'Total Ventas']],
          body: routeStats.map(rs => [
            rs.route_name,
            rs.client_count,
            `$${rs.total_sales.toFixed(2)}`,
          ]),
        });
      }

      pdf.save(`reporte_completo_${startDate}_${endDate}.pdf`);
    } catch (error) {
      console.error('Error generating complete PDF:', error);
      alert('Error al generar el PDF completo');
    }
  };

  const totalPayments = collectorPayments.reduce((sum, cp) => sum + cp.total_payments, 0);
  const totalSales = collectorSales.reduce((sum, cs) => sum + cs.total_sales, 0);
  const totalClients = clientsByCollector.reduce((sum, cc) => sum + cc.client_count, 0);
  const latePaymentsCount = latePaymentStats.find(lp => lp.status === 'Atrasado')?.count || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes y Análisis</h1>
          <p className="text-gray-600 mt-1">Visualiza el rendimiento de tu negocio</p>
        </div>
        <button
          onClick={downloadCompletePDF}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          <FileText size={20} />
          Descargar Reporte Completo (PDF)
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 w-full sm:w-auto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 w-full sm:w-auto"
              />
            </div>
          </div>
          <button
            onClick={loadReports}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-300"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Pagos</p>
              <p className="text-3xl font-bold mt-1">${totalPayments.toFixed(2)}</p>
            </div>
            <DollarSign size={40} className="text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Ventas</p>
              <p className="text-3xl font-bold mt-1">${totalSales.toFixed(2)}</p>
            </div>
            <TrendingUp size={40} className="text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Clientes</p>
              <p className="text-3xl font-bold mt-1">{totalClients}</p>
            </div>
            <Users size={40} className="text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Pagos Atrasados</p>
              <p className="text-3xl font-bold mt-1">{latePaymentsCount}</p>
            </div>
            <AlertTriangle size={40} className="text-red-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6" ref={paymentsChartRef}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Pagos por Cobrador</h2>
            <div className="flex gap-2">
              <button
                onClick={() => downloadChartAsImage(paymentsChartRef, 'pagos_por_cobrador')}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                title="Descargar como imagen"
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => downloadChartAsPDF(paymentsChartRef, 'pagos_por_cobrador')}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Descargar como PDF"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={() => downloadAsExcel(collectorPayments, 'pagos_por_cobrador')}
                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition"
                title="Descargar como Excel"
              >
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </div>
          {collectorPayments.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectorPayments}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="collector_name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="total_payments" name="Total Pagos" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No hay datos disponibles</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 md:p-6" ref={salesChartRef}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Ventas por Cobrador</h2>
            <div className="flex gap-2">
              <button
                onClick={() => downloadChartAsImage(salesChartRef, 'ventas_por_cobrador')}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                title="Descargar como imagen"
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => downloadChartAsPDF(salesChartRef, 'ventas_por_cobrador')}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Descargar como PDF"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={() => downloadAsExcel(collectorSales, 'ventas_por_cobrador')}
                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition"
                title="Descargar como Excel"
              >
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </div>
          {collectorSales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectorSales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="collector_name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="total_sales" name="Total Ventas" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No hay datos disponibles</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 md:p-6" ref={routesChartRef}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Estadísticas por Ruta</h2>
            <div className="flex gap-2">
              <button
                onClick={() => downloadChartAsImage(routesChartRef, 'estadisticas_rutas')}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                title="Descargar como imagen"
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => downloadChartAsPDF(routesChartRef, 'estadisticas_rutas')}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Descargar como PDF"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={() => downloadAsExcel(routeStats, 'estadisticas_rutas')}
                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition"
                title="Descargar como Excel"
              >
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </div>
          {routeStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={routeStats}
                  dataKey="client_count"
                  nameKey="route_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.route_name}: ${entry.client_count}`}
                >
                  {routeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No hay datos disponibles</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 md:p-6" ref={clientsChartRef}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Clientes por Cobrador</h2>
            <div className="flex gap-2">
              <button
                onClick={() => downloadChartAsImage(clientsChartRef, 'clientes_por_cobrador')}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                title="Descargar como imagen"
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => downloadChartAsPDF(clientsChartRef, 'clientes_por_cobrador')}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Descargar como PDF"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={() => downloadAsExcel(clientsByCollector, 'clientes_por_cobrador')}
                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition"
                title="Descargar como Excel"
              >
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </div>
          {clientsByCollector.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clientsByCollector}
                  dataKey="client_count"
                  nameKey="collector_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.collector_name}: ${entry.client_count}`}
                >
                  {clientsByCollector.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No hay datos disponibles</p>
            </div>
          )}
        </div>
      </div>

      {paymentTrend.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Tendencia de Pagos</h2>
            <div className="flex gap-2">
              <button
                onClick={() => downloadAsExcel(paymentTrend, 'tendencia_pagos')}
                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition"
                title="Descargar como Excel"
              >
                <FileSpreadsheet size={18} />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={paymentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="amount" name="Monto" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {latePaymentStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Estado de Pagos Vencidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {latePaymentStats.map((stat) => (
              <div
                key={stat.status}
                className={`p-4 rounded-lg border-2 ${
                  stat.status === 'Atrasado'
                    ? 'bg-red-50 border-red-200'
                    : stat.status === 'Pagado'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p className="text-sm font-medium text-gray-600">{stat.status}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.count}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Total: ${stat.total_amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Tabla de Datos - Pagos por Cobrador</h2>
        <div className="block md:hidden">
          <div className="divide-y divide-gray-200">
            {collectorPayments.map((cp, index) => (
              <div key={index} className="p-4">
                <p className="font-semibold text-gray-900">{cp.collector_name}</p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">Total Pagos</p>
                    <p className="text-lg font-bold text-orange-600">${cp.total_payments.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cantidad</p>
                    <p className="text-lg font-bold text-gray-900">{cp.payment_count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cobrador</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Pagos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {collectorPayments.map((cp, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cp.collector_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                    ${cp.total_payments.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cp.payment_count}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL GENERAL</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                  ${totalPayments.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {collectorPayments.reduce((sum, cp) => sum + cp.payment_count, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

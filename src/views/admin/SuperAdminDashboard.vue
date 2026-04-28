<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import analyticsService from '@/services/analytics.service'

interface KPI {
  totalSales: number;
  transactionCount: number;
  avgTicket: number;
  growth?: number;
}

interface BranchStat {
  branch: string;
  channel: string;
  isDigital: boolean;
  totalSales: number;
  count: number;
}

interface SellerStat {
  name: string;
  totalSales: number;
  count: number;
}

interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
}

interface DashboardData {
  kpis: KPI;
  branchBreakdown: BranchStat[];
  sellerRanking: SellerStat[];
  topProducts: ProductStat[];
}

interface AdInsight {
  ad_name: string;
  campaign_name: string;
  spend: string | number;
  impressions: string | number;
  clicks: string | number;
  reach: string | number;
  actions: Array<{ action_type: string; value: string | number }>;
  effective_status: string;
}

const loading = ref(true)
const loadingAds = ref(false)
const period = ref<'day' | 'week' | 'month'>('month')
const globalBrand = ref<'all' | 'nicole' | 'sucree'>('all')
const data = ref<DashboardData | null>(null)

// Ads State
const adsInsights = ref<Record<'sucree' | 'nicole', AdInsight[]>>({
  sucree: [],
  nicole: []
})

// Client/Account IDs
const ADS_CONFIG = {
  sucree: {
    clientId: '69a79d489667fc52f66e5e39',
    accountId: '4155874788065730'
  },
  nicole: {
    clientId: '69b662df94d35e1654e58f27', // Placeholder/Inferred
    accountId: '120231554762190606' // Placeholder
  }
}

const fetchStats = async () => {
  loading.value = true
  try {
    const source = globalBrand.value === 'all' ? undefined : globalBrand.value
    const res = await analyticsService.getSuperAdminAnalytics(period.value, source)
    data.value = res
  } catch (error) {
    console.error('Error fetching stats:', error)
  } finally {
    loading.value = false
  }
}

const fetchAds = async () => {
  loadingAds.value = true
  try {
    const datePreset = period.value === 'day' ? 'today' : period.value === 'week' ? 'last_7d' : 'this_month'
    
    const brandsToFetch: Array<'sucree' | 'nicole'> = globalBrand.value === 'all' 
      ? ['sucree', 'nicole'] 
      : [globalBrand.value]

    const promises = brandsToFetch.map(async (brand) => {
      const config = ADS_CONFIG[brand]
      try {
        const res = await analyticsService.getMetaAdsInsights(config.clientId, config.accountId, datePreset)
        adsInsights.value[brand] = res.insights || []
      } catch (e) {
        console.error(`Error fetching ${brand} ads:`, e)
        adsInsights.value[brand] = []
      }
    })

    await Promise.all(promises)
  } catch (error) {
    console.error(`Error in fetchAds:`, error)
  } finally {
    loadingAds.value = false
  }
}

const changePeriod = (p: 'day' | 'week' | 'month') => {
  period.value = p
  fetchStats()
  fetchAds()
}

const changeGlobalBrand = (brand: 'all' | 'nicole' | 'sucree') => {
  globalBrand.value = brand
  fetchStats()
  fetchAds()
}

onMounted(() => {
  fetchStats()
  fetchAds()
})

const kpis = computed(() => data.value?.kpis || { totalSales: 0, transactionCount: 0, avgTicket: 0 })
const branchBreakdown = computed(() => data.value?.branchBreakdown || [])
const sellerRanking = computed(() => data.value?.sellerRanking || [])
const topProducts = computed(() => data.value?.topProducts || [])

const maxBranchSale = computed(() => {
  if (branchBreakdown.value.length === 0) return 1
  return Math.max(...branchBreakdown.value.map((b: BranchStat) => b.totalSales))
})

const maxSellerSale = computed(() => {
  if (sellerRanking.value.length === 0) return 1
  return Math.max(...sellerRanking.value.map((s: SellerStat) => s.totalSales))
})

const formatCurrency = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (!num) return '$0.00'
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(num)
}

const formatNumber = (val: number | string) => {
  const num = typeof val === 'string' ? parseInt(val) : val
  if (!num) return '0'
  return new Intl.NumberFormat('es-EC').format(num)
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
}

const getConversions = (ad: AdInsight) => {
  const action = ad.actions?.find(a => a.action_type === 'onsite_conversion.total_messaging_connection')
  return action ? parseInt(action.value as string) : 0
}
</script>

<template>
  <div class="super-admin-dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <div class="title-row">
          <h1>Panel de Gerencia</h1>
          <div class="global-brand-selector">
            <button 
              v-for="b in (['all', 'nicole', 'sucree'] as const)" 
              :key="b"
              :class="['brand-pill', { active: globalBrand === b }]"
              @click="changeGlobalBrand(b)"
            >
              {{ b === 'all' ? 'Todo' : b === 'nicole' ? 'Nicole' : 'Sucrée' }}
            </button>
          </div>
        </div>
        <p class="subtitle">Análisis consolidado de rendimiento y pauta publicitaria</p>
      </div>

      <div class="period-selector">
        <button 
          v-for="p in (['day', 'week', 'month'] as const)" 
          :key="p"
          :class="['period-btn', { active: period === p }]"
          @click="changePeriod(p)"
        >
          {{ p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando datos estratégicos...</p>
    </div>

    <div v-else class="dashboard-content">
      <!-- KPI Cards Row -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Venta Total</div>
          <div class="kpi-value">{{ formatCurrency(kpis.totalSales) }}</div>
          <div v-if="kpis.growth !== undefined" :class="['kpi-growth', { positive: kpis.growth >= 0, negative: kpis.growth < 0 }]">
            <span class="icon">{{ kpis.growth >= 0 ? '↑' : '↓' }}</span>
            {{ Math.abs(kpis.growth) }}% vs anterior
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Ticket Promedio</div>
          <div class="kpi-value">{{ formatCurrency(kpis.avgTicket) }}</div>
          <div class="kpi-subtext">Global del periodo</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Transacciones</div>
          <div class="kpi-value">{{ formatNumber(kpis.transactionCount) }}</div>
          <div class="kpi-subtext">Órdenes procesadas</div>
        </div>
      </div>

      <div class="main-grid">
        <!-- Branch Sales Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <h2>Ventas por Punto de Venta</h2>
            <p>Físico vs Digital</p>
          </div>
          
          <div class="branch-list">
            <div v-for="branch in branchBreakdown" :key="branch.branch + branch.channel" class="branch-item">
              <div class="branch-info">
                <span class="branch-name">
                  {{ branch.branch }} 
                  <span v-if="branch.isDigital" class="badge-digital">Digital</span>
                </span>
                <span class="branch-total">{{ formatCurrency(branch.totalSales) }}</span>
              </div>
              <div class="branch-bar-container">
                <div 
                  class="branch-bar" 
                  :style="{ width: (branch.totalSales / maxBranchSale) * 100 + '%' }"
                  :class="{ 'bar-digital': branch.isDigital }"
                ></div>
              </div>
              <div class="branch-meta">
                {{ branch.count }} transacciones • {{ branch.channel }}
              </div>
            </div>
          </div>
        </section>

        <!-- Seller Ranking Section -->
        <section class="dashboard-section ranking-section">
          <div class="section-header">
            <h2>Ranking de Vendedores</h2>
            <p>Top performance por ventas</p>
          </div>

          <div class="seller-list">
            <div v-for="(seller, index) in sellerRanking" :key="seller.name" class="seller-item">
              <div class="rank-number" :class="`rank-${Number(index) + 1}`">{{ Number(index) + 1 }}</div>
              <div class="seller-avatar">{{ getInitials(seller.name) }}</div>
              <div class="seller-info">
                <div class="seller-name-row">
                  <span class="seller-name">{{ seller.name }}</span>
                  <span class="seller-total">{{ formatCurrency(seller.totalSales) }}</span>
                </div>
                <div class="seller-progress-container">
                  <div class="seller-progress" :style="{ width: (seller.totalSales / maxSellerSale) * 100 + '%' }"></div>
                </div>
                <div class="seller-meta">{{ seller.count }} órdenes cerradas</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Top Products Section -->
        <section class="dashboard-section products-section">
          <div class="section-header">
            <h2>Top 10 Productos</h2>
            <p>Los más vendidos del periodo</p>
          </div>

          <div class="product-table">
            <div class="product-row header">
              <span>Producto</span>
              <span class="text-center">Cant.</span>
              <span class="text-right">Ingresos</span>
            </div>
            <div v-for="product in topProducts" :key="product.name" class="product-row">
              <span class="product-name">{{ product.name }}</span>
              <span class="product-qty">{{ product.quantity }}</span>
              <span class="product-rev">{{ formatCurrency(product.revenue) }}</span>
            </div>
          </div>
        </section>

        <!-- Ads Insights Section -->
        <section class="dashboard-section ads-section">
          <div class="section-header">
            <h2>Rendimiento de Pauta (Meta Ads)</h2>
            <p>Inversión vs Conversiones</p>
          </div>

          <div v-if="loadingAds" class="loading-mini">
            <div class="spinner-small"></div>
            <span>Sincronizando con Meta...</span>
          </div>

          <div v-else class="ads-container">
            <!-- Brand Group: Sucrée -->
            <div v-if="globalBrand === 'all' || globalBrand === 'sucree'" class="brand-ads-group">
              <h3 class="brand-title sucree">Sucrée</h3>
              <div v-if="adsInsights.sucree.length === 0" class="empty-ads">Sin pauta activa.</div>
              <div class="ads-grid">
                <div v-for="ad in adsInsights.sucree" :key="ad.ad_name" class="ad-card">
                  <div class="ad-header">
                    <h3>{{ ad.ad_name }}</h3>
                    <span class="campaign-name">{{ ad.campaign_name }}</span>
                  </div>
                  <div class="ad-stats">
                    <div class="ad-stat">
                      <span class="label">Inversión</span>
                      <span class="value">{{ formatCurrency(ad.spend) }}</span>
                    </div>
                    <div class="ad-stat">
                      <span class="label">Mensajes</span>
                      <span class="value highlight">{{ getConversions(ad) }}</span>
                    </div>
                  </div>
                  <div class="ad-reach">
                    <div class="reach-info">
                      <span>Costo x Msg: {{ getConversions(ad) > 0 ? formatCurrency(parseFloat(ad.spend as string) / getConversions(ad)) : '$0.00' }}</span>
                      <span v-if="ad.effective_status" :class="['status-badge', ad.effective_status.toLowerCase()]">
                        {{ ad.effective_status }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Brand Group: Nicole -->
            <div v-if="globalBrand === 'all' || globalBrand === 'nicole'" class="brand-ads-group">
              <h3 class="brand-title nicole">Nicole</h3>
              <div v-if="adsInsights.nicole.length === 0" class="empty-ads">Sin pauta activa.</div>
              <div class="ads-grid">
                <div v-for="ad in adsInsights.nicole" :key="ad.ad_name" class="ad-card">
                  <div class="ad-header">
                    <h3>{{ ad.ad_name }}</h3>
                    <span class="campaign-name">{{ ad.campaign_name }}</span>
                  </div>
                  <div class="ad-stats">
                    <div class="ad-stat">
                      <span class="label">Inversión</span>
                      <span class="value">{{ formatCurrency(ad.spend) }}</span>
                    </div>
                    <div class="ad-stat">
                      <span class="label">Mensajes</span>
                      <span class="value highlight">{{ getConversions(ad) }}</span>
                    </div>
                  </div>
                  <div class="ad-reach">
                    <div class="reach-info">
                      <span>Costo x Msg: {{ getConversions(ad) > 0 ? formatCurrency(parseFloat(ad.spend as string) / getConversions(ad)) : '$0.00' }}</span>
                      <span v-if="ad.effective_status" :class="['status-badge', ad.effective_status.toLowerCase()]">
                        {{ ad.effective_status }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.super-admin-dashboard {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  background-color: #f8f9fa;
  min-height: 100vh;

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;

    .title-row {
      display: flex;
      align-items: center;
      gap: 1.5rem;

      h1 {
        font-family: $font-principal;
        color: $NICOLE-PURPLE;
        font-size: 2rem;
        margin: 0;
      }

      .global-brand-selector {
        display: flex;
        background: #e9ecef;
        padding: 4px;
        border-radius: 50px;
        gap: 4px;

        .brand-pill {
          padding: 6px 16px;
          border-radius: 50px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.85rem;
          color: #6c757d;
          transition: all 0.2s;

          &.active {
            background: white;
            color: $NICOLE-PURPLE;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          }
        }
      }
    }

    .subtitle {
      color: #6c757d;
      margin: 0.25rem 0 0 0;
    }

    .period-selector {
      display: flex;
      background: #eee;
      padding: 0.25rem;
      border-radius: 12px;

      .period-btn {
        padding: 0.5rem 1.25rem;
        border: none;
        background: transparent;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        color: #666;

        &.active {
          background: white;
          color: $NICOLE-PURPLE;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      }
    }
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;

    .kpi-card {
      background: white;
      padding: 1.5rem;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      border: 1px solid #eee;

      .kpi-label {
        color: #6c757d;
        font-size: 0.9rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 0.5rem;
      }

      .kpi-value {
        font-size: 2rem;
        font-weight: 700;
        color: #212529;
        margin-bottom: 0.5rem;
      }

      .kpi-growth {
        font-size: 0.85rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.25rem;

        &.positive { color: #28a745; }
        &.negative { color: #dc3545; }
      }

      .kpi-subtext {
        color: #adb5bd;
        font-size: 0.8rem;
      }
    }
  }

  .main-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 1.5rem;

    @media (max-width: 600px) {
      grid-template-columns: 1fr;
    }
  }

  .dashboard-section {
    background: white;
    padding: 1.5rem;
    border-radius: 20px;
    box-shadow: 0 4px 25px rgba(0,0,0,0.03);
    border: 1px solid #eee;
    display: flex;
    flex-direction: column;

    .section-header {
      margin-bottom: 1.5rem;
      
      h2 {
        font-size: 1.1rem;
        color: $NICOLE-PURPLE;
        margin: 0;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      p {
        color: #adb5bd;
        margin: 0.2rem 0 0 0;
        font-size: 0.85rem;
      }
    }
  }

  .branch-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    .branch-item {
      .branch-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.4rem;
        font-weight: 600;

        .branch-name {
          color: #495057;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
        }

        .badge-digital {
          background: rgba($NICOLE-PURPLE, 0.1);
          color: $NICOLE-PURPLE;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.65rem;
          font-weight: 700;
        }
      }

      .branch-bar-container {
        height: 8px;
        background: #f1f3f5;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 0.25rem;

        .branch-bar {
          height: 100%;
          background: #dee2e6;
          border-radius: 4px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);

          &.bar-digital {
            background: linear-gradient(90deg, $NICOLE-PURPLE, lighten($NICOLE-PURPLE, 15%));
          }
        }
      }

      .branch-meta {
        font-size: 0.75rem;
        color: #adb5bd;
      }
    }
  }

  .seller-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    .seller-item {
      display: flex;
      align-items: center;
      gap: 1rem;

      .rank-number {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
        border-radius: 50%;
        background: #f1f3f5;
        color: #adb5bd;

        &.rank-1 { background: #FFD700; color: white; }
        &.rank-2 { background: #C0C0C0; color: white; }
        &.rank-3 { background: #CD7F32; color: white; }
      }

      .seller-avatar {
        width: 40px;
        height: 40px;
        background: $NICOLE-PURPLE;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.9rem;
        flex-shrink: 0;
      }

      .seller-info {
        flex: 1;

        .seller-name-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.3rem;
          
          .seller-name {
            font-weight: 600;
            color: #495057;
            font-size: 0.95rem;
          }
          .seller-total {
            font-weight: 700;
            color: $NICOLE-PURPLE;
          }
        }

        .seller-progress-container {
          height: 6px;
          background: #f1f3f5;
          border-radius: 3px;
          margin-bottom: 0.2rem;
          
          .seller-progress {
            height: 100%;
            background: $NICOLE-PURPLE;
            border-radius: 3px;
            transition: width 0.8s ease-out;
          }
        }

        .seller-meta {
          font-size: 0.75rem;
          color: #adb5bd;
        }
      }
    }
  }

  .product-table {
    display: flex;
    flex-direction: column;
    
    .product-row {
      display: grid;
      grid-template-columns: 1fr 60px 100px;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f3f5;
      font-size: 0.9rem;
      align-items: center;

      &.header {
        font-weight: 700;
        color: #adb5bd;
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 1px;
      }

      &:last-child { border-bottom: none; }

      .product-name {
        font-weight: 600;
        color: #495057;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .product-qty {
        text-align: center;
        color: #6c757d;
        font-weight: 700;
      }

      .product-rev {
        text-align: right;
        color: #212529;
        font-weight: 700;
      }
    }
  }

  .ads-container {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;

    .brand-ads-group {
      .brand-title {
        font-size: 0.9rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #eee;

        &.sucree { color: #e67e22; border-color: rgba(#e67e22, 0.2); }
        &.nicole { color: $NICOLE-PURPLE; border-color: rgba($NICOLE-PURPLE, 0.2); }
      }
    }

    .ads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .empty-ads {
      text-align: center;
      padding: 1rem;
      color: #adb5bd;
      font-style: italic;
      font-size: 0.85rem;
    }

    .ad-card {
      background: #fafafa;
      border-radius: 12px;
      padding: 1rem;
      border: 1px solid #f1f3f5;

      .ad-header {
        margin-bottom: 0.75rem;
        
        h3 {
          margin: 0;
          font-size: 0.9rem;
          color: #212529;
          font-weight: 700;
        }
        
        .campaign-name {
          font-size: 0.7rem;
          color: #adb5bd;
          display: block;
          margin-top: 2px;
        }
      }

      .ad-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.75rem;

        .ad-stat {
          display: flex;
          flex-direction: column;

          .label {
            font-size: 0.6rem;
            color: #adb5bd;
            text-transform: uppercase;
            font-weight: 700;
          }

          .value {
            font-size: 0.95rem;
            font-weight: 800;
            color: #495057;

            &.highlight { color: $NICOLE-PURPLE; }
          }
        }
      }

      .ad-reach {
        border-top: 1px dashed #dee2e6;
        padding-top: 0.5rem;
        
        .reach-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #6c757d;
          align-items: center;

          .status-badge {
            font-size: 0.6rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            background: #eee;
            &.active { background: #e3f9e5; color: #28a745; }
            &.campaign_paused, &.paused { background: #fff5f5; color: #dc3545; }
          }
        }
      }
    }
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: $NICOLE-PURPLE;

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba($NICOLE-PURPLE, 0.1);
      border-top-color: $NICOLE-PURPLE;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
  }

  .loading-mini {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #adb5bd;
    font-size: 0.9rem;

    .spinner-small {
      width: 20px;
      height: 20px;
      border: 2px solid rgba($NICOLE-PURPLE, 0.1);
      border-top-color: $NICOLE-PURPLE;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

import axios from 'axios';

export interface TradeOrder {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    priceLimit?: number;
}

export interface MarketMetrics {
    symbol: string;
    priceUSD: number;
    change24h: number;
}

export class TradingManager {
    private activePositions: TradeOrder[] = [];

    /**
     * Fetches current live cryptocurrency/asset market prices and trends
     */
    public async fetchMarketStatus(): Promise<MarketMetrics[]> {
        try {
            const response = await axios.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'
            );
            const data = response.data;
            const results: MarketMetrics[] = [];

            for (const [coin, metrics] of Object.entries<any>(data)) {
                results.push({
                    symbol: coin.toUpperCase(),
                    priceUSD: metrics.usd,
                    change24h: metrics.usd_24h_change
                });
            }

            return results;
        } catch (error) {
            console.error('Error fetching market feeds:', error);
            return [];
        }
    }

    /**
     * Places and logs a trade order
     */
    public placeTrade(order: TradeOrder): string {
        if (order.quantity <= 0) {
            return `❌ Failed: Order quantity must be greater than zero.`;
        }

        this.activePositions.push(order);
        console.log(`[TRADE EXECUTED] ${order.action} ${order.quantity} of ${order.symbol}`);
        
        return `✅ Successfully placed ${order.action} order for ${order.quantity} ${order.symbol}.`;
    }

    /**
     * Retrieves all active trade positions
     */
    public getActivePositions(): TradeOrder[] {
        return this.activePositions;
    }
}

export const trader = new TradingManager();

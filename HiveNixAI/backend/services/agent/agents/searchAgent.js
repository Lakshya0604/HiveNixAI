import { getModel } from "../config/llmModel.js"
import { searchTool } from "../config/tavily.js"
import { isTokenLimitError } from "../utils/tokenHelper.js"
import {
    isGitHubRequest,
    runGitHubQuery,
    detectLanguage,
    isRateLimitError,
    retryAfterText,
    formatGitHubDirect,
    formatRepoListDirect,
    formatTreeDirect,
    formatCommitListDirect,
    formatBranchListDirect,
} from "../config/githubMcp.js"

// ---------- Time helpers ----------
function getCurrentTime() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    const offset = now.getTimezoneOffset()
    const sign = offset <= 0 ? "+" : "-"
    const abs = Math.abs(offset)
    const tz = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
    let tzName = ""
    try {
        tzName = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        tzName = ""
    }
    return {
        iso: now.toISOString(),
        utc: now.toUTCString(),
        local: now.toString(),
        timezoneOffset: tz,
        timezoneName: tzName,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        dayOfWeek: now.getDay(),
    }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

// Timezone offsets for common cities (in minutes from UTC)
// Positive = ahead of UTC, Negative = behind UTC
const CITY_TIMEZONES = {
    // India
    'agra': 330, 'mumbai': 330, 'delhi': 330, 'bangalore': 330, 'chennai': 330, 'kolkata': 330, 'hyderabad': 330, 'pune': 330, 'ahmedabad': 330, 'jaipur': 330, 'lucknow': 330, 'kanpur': 330, 'nagpur': 330, 'indore': 330, 'thane': 330, 'bhopal': 330, 'visakhapatnam': 330, 'pimpri': 330, 'patna': 330, 'vadodara': 330, 'ghaziabad': 330, 'ludhiana': 330, 'agra': 330, 'nashik': 330, 'faridabad': 330, 'meerut': 330, 'rajkot': 330, 'kalyan': 330, 'vasai': 330, 'varanasi': 330, 'srinagar': 330, 'aurangabad': 330, 'dhanbad': 330, 'amritsar': 330, 'navi mumbai': 330, 'allahabad': 330, 'ranchi': 330, 'howrah': 330, 'coimbatore': 330, 'jabalpur': 330, 'gwalior': 330, 'vijayawada': 330, 'jodhpur': 330, 'madurai': 330, 'raipur': 330, 'kota': 330, 'guwahati': 330, 'chandigarh': 330, 'solapur': 330, 'hubballi': 330, 'tiruchirappalli': 330, 'bareilly': 330, 'mysore': 330, 'tiruppur': 330, 'gurgaon': 330, 'aligarh': 330, 'jalandhar': 330, 'bhubaneswar': 330, 'salem': 330, 'warangal': 330, 'guntur': 330, 'bhiwandi': 330, 'saharanpur': 330, 'gorakhpur': 330, 'bikaner': 330, 'amravati': 330, 'noida': 330, 'jamshedpur': 330, 'bhilai': 330, 'cuttack': 330, 'firozabad': 330, 'kochi': 330, 'nellore': 330, 'bhavnagar': 330, 'dehradun': 330, 'durgapur': 330, 'asansol': 330, 'rourkela': 330, 'nanded': 330, 'kolhapur': 330, 'ajmer': 330, 'akola': 330, 'gulbarga': 330, 'jamnagar': 330, 'ujjain': 330, 'loni': 330, 'siliguri': 330, 'jhansi': 330, 'ulhasnagar': 330, 'jammu': 330, 'sangli': 330, 'mangalore': 330, 'erode': 330, 'belgaum': 330, 'ambattur': 330, 'tirunelveli': 330, 'malegaon': 330, 'gaya': 330, 'jalgaon': 330, 'udaipur': 330, 'maheshtala': 330,

    // Major world cities
    'london': 0, 'new york': -240, 'los angeles': -420, 'chicago': -300, 'toronto': -240, 'vancouver': -420,
    'paris': 60, 'berlin': 60, 'rome': 60, 'madrid': 60, 'amsterdam': 60, 'brussels': 60, 'vienna': 60,
    'moscow': 180, 'dubai': 240, 'singapore': 480, 'hong kong': 480, 'tokyo': 540, 'seoul': 540,
    'beijing': 480, 'shanghai': 480, 'sydney': 600, 'melbourne': 600, 'auckland': 720,
    'sao paulo': -180, 'buenos aires': -180, 'mexico city': -300, 'bogota': -300, 'lima': -300,
    'cairo': 120, 'johannesburg': 120, 'lagos': 60, 'nairobi': 180,
    'istanbul': 180, 'tehran': 210, 'karachi': 300, 'dhaka': 360, 'bangkok': 420,
    'kuala lumpur': 480, 'manila': 480, 'jakarta': 420, 'ho chi minh city': 420,
    'taipei': 480, 'tel aviv': 120, 'riyadh': 180, 'doha': 180, 'kuwait city': 180,
    'baghdad': 180, 'muscat': 240, 'abuja': 60, 'accra': 0, 'casablanca': 60,
    'cape town': 120, 'dar es salaam': 180, 'addis ababa': 180, 'khartoum': 120,
    'tunis': 60, 'algiers': 60, 'tripoli': 120, 'sanaa': 180, 'amman': 180,
    'beirut': 120, 'damascus': 120, 'ankara': 180, 'yerevan': 240, 'tbilisi': 240,
    'baku': 240, 'ashgabat': 300, 'dushanbe': 300, 'tashkent': 300, 'bishkek': 360,
    'almaty': 360, 'astana': 360, 'ulaanbaatar': 480, 'pyongyang': 540,
    'honolulu': -600, 'anchorage': -540, 'santiago': -180, 'montevideo': -180,
    'la paz': -240, 'quito': -300, 'paramaribo': -180, 'georgetown': -240,
    'kingston': -300, 'port au prince': -300, 'santo domingo': -240,
    'san juan': -240, 'nassau': -240, 'hamilton': -240, 'road town': -240,
    'george town': -300, 'philipsburg': -240, 'marigot': -240, 'the valley': -240,
    'bridgetown': -240, 'castries': -240, 'st georges': -240, 'kingstown': -240,
    'basse terre': -240, 'fort de france': -240, 'pointe a pitre': -240,
    'cayenne': -180, 'nuuk': -120, 'reykjavik': 0, 'longyearbyen': 60,
    'torshavn': 0, 'mariehamn': 180, 'gibraltar': 60, 'vaduz': 60,
    'san marino': 60, 'vatican city': 60, 'monaco': 60, 'andorra la vella': 60,
    'luanda': 60, 'windhoek': 60, 'gaborone': 120, 'maseru': 120, 'mbabane': 120,
    'lome': 0, 'ouagadougou': 0, 'bamako': 0, 'conakry': 0, 'freelton': 0,
    'banjul': 0, 'dakar': 0, 'nouakchott': 0, 'praia': -60, 'bissau': 0,
    'yamoussoukro': 0, 'abidjan': 0, 'porto novo': 60, 'libreville': 60,
    'sao tome': 0, 'malabo': 60, 'brazzaville': 60, 'kinshasa': 60,
    'bangui': 60, 'ndjamena': 60, 'niamey': 60, 'ouagadougou': 0,
    'kigali': 120, 'bujumbura': 120, 'dodoma': 180, 'kampala': 180,
    'mombasa': 180, 'nairobi': 180, 'dar es salaam': 180, 'zanzibar city': 180,
    'lilongwe': 120, 'blantyre': 120, 'lusaka': 120, 'harare': 120,
    'maputo': 120, 'windhoek': 60, 'gaborone': 120, 'maseru': 120,
    'mbabane': 120, 'antananarivo': 180, 'port louis': 240, 'victoria': 240,
    'moroni': 180, 'mamaroneck': 180, 'honiara': 660, 'port vila': 660,
    'suva': 720, 'nukualofa': 780, 'apia': 780, 'pago pago': -660,
    'funafuti': 720, 'tarawa': 720, 'majut': 720, 'palikir': 660,
    'hagatna': 600, 'saipan': 600, 'washington dc': -240, 'ottawa': -240,
    'mexico city': -300, 'guatemala city': -360, 'san salvador': -360,
    'tegucigalpa': -360, 'managua': -360, 'san jose': -360, 'panama city': -300,
    'bogota': -300, 'caracas': -240, 'georgetown': -240, 'paramaribo': -180,
    'cayenne': -180, 'la paz': -240, 'sucre': -240, 'quito': -300,
    'lima': -300, 'asuncion': -180, 'montevideo': -180, 'buenos aires': -180,
    'santiago': -180, 'ushuaia': -180, 'stanley': -180,
}

// OpenWeatherMap API key
const WEATHER_API_KEY = "b94032cf4c8cf975f2146819431e963a"
const WEATHER_API_BASE = "https://api.openweathermap.org/data/2.5"

// API Ninjas Finance API
const FINANCE_API_KEY = "ITgc3nGoMpMEXPy604uapATOyym59e5P7LezRKY1"
const FINANCE_API_BASE = "https://api.api-ninjas.com/v1"

// ---------- Intent detection ----------
function detectIntent(q) {
    const isImageRequest = /image|photo|picture|pic|img|screenshot|gif|wallpaper/i.test(q)
    const noImageRequest = /no image|without image|don'?t include image|no pictures?|without pictures?|skip image/i.test(q)

    // NEW: images are attached by default for every query, unless user opts out.
    const wantsImages = !noImageRequest

    const isLinkRequest = /\blink|url|website|article|articles|news|trending|headlines\b/i.test(q)
    const isTimeRequest = /what('?s| is) the (time|date)|what time is it|what'?s the time|current time|current date|time (now|in)|right now|time zone|today'?s date/i.test(q)

    // Weather queries
    const isWeatherRequest = /weather|temperature|forecast|humidity|rain|snow|wind|sunny|cloudy|storm|climate/i.test(q)

    // Sports queries - use Tavily search for live sports data
    const isSportsRequest = /score|match|fixture|live|standings|table|league|team|player|football|soccer|cricket|basketball|tennis|hockey|baseball|ipl|premier league|la liga|champions league|world cup|fifa|uefa|nba|nfl|mlb|nhl|scoreboard|result|upcoming|today'?s match|yesterday'?s match|last match|next match/i.test(q)

    // Finance queries
    const isFinanceRequest = /stock|price|quote|ticker|market|crypto|bitcoin|ethereum|btc|eth|currency|exchange|forex|gold|silver|oil|commodity|inflation|interest rate|gdp|earnings|dividend|pe ratio|market cap|volume|52 week|ipo|earnings|dividend|yahoo finance|nasdaq|nyse|dow jones|s&p|sp500|nifty|sensex|reliance|tcs|infosys|hdfc|icici|sbi|tata|airtel|bajaj|maruti|asian paints|itc|hindustan unilever|kotak|axis|larsen|mahindra|wipro|tech mahindra|adani|jsw|vedanta|coal india|ntpc|power grid|ongc|bhel|sail|gail|iocl|bpcl|hpcl/i.test(q)

    // Current-data queries need the news search tool (topic: "news")
    // so results are always fresh, like Google. General queries use the
    // general tool which may return older encyclopedic content.
    const isNewsRequest = /\bnews|latest|current|recent|today|now|breaking|upcoming|this week|this month|this year|2024|2025|2026\b/i.test(q)

    return { isImageRequest, wantsImages, isLinkRequest, isTimeRequest, isNewsRequest, isWeatherRequest, isSportsRequest, isFinanceRequest }
}

// Extract an explicit image count from ANYWHERE in the prompt.
// Handles "5 images", "give me 8 pics", or a bare number like "show 6 of them"
// when the topic is clearly about images.
function extractImageCount(prompt, isImageRequest) {
    // Strongest signal: number directly next to an image-word
    const m = prompt.match(/(\d+)\s*(images?|photos?|pictures?|pics?)/i)
    if (m) {
        const n = parseInt(m[1], 10)
        if (Number.isFinite(n) && n > 0) return Math.min(n, 20)
    }
    // Reverse order: "images: 5" or "give 5"
    const m2 = prompt.match(/(images?|photos?|pictures?|pics?)\D{0,10}(\d+)/i)
    if (m2) {
        const n = parseInt(m2[2], 10)
        if (Number.isFinite(n) && n > 0) return Math.min(n, 20)
    }
    return null // no explicit number found
}

// ---------- Weather API ----------
async function fetchWeather(city) {
    try {
        // Get current weather
        const currentUrl = `${WEATHER_API_BASE}/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric`
        const currentRes = await fetch(currentUrl)
        if (!currentRes.ok) {
            if (currentRes.status === 404) return { error: `City "${city}" not found` }
            throw new Error(`Weather API error: ${currentRes.status}`)
        }
        const current = await currentRes.json()

        // Get 5-day forecast (3-hour intervals)
        const forecastUrl = `${WEATHER_API_BASE}/forecast?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric`
        const forecastRes = await fetch(forecastUrl)
        const forecast = forecastRes.ok ? await forecastRes.json() : null

        return { current, forecast }
    } catch (err) {
        console.error("Weather fetch error:", err)
        return { error: err.message }
    }
}

// ---------- Finance API (API Ninjas) ----------
async function fetchFinanceData(type, params = {}) {
    try {
        let url = `${FINANCE_API_BASE}/${type}`
        const queryParams = new URLSearchParams(params)
        if (queryParams.toString()) url += `?${queryParams.toString()}`

        const res = await fetch(url, {
            headers: { 'X-Api-Key': FINANCE_API_KEY, 'Accept': 'application/json' }
        })
        if (!res.ok) throw new Error(`Finance API error: ${res.status}`)

        const contentType = res.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
            return await res.json()
        } else {
            // Parse text/table format
            const text = await res.text()
            return parseTableResponse(text)
        }
    } catch (err) {
        console.error("Finance fetch error:", err)
        return { error: err.message }
    }
}

// Parse text/table response from API Ninjas
function parseTableResponse(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return { error: 'Invalid response format' }

    // Find header line (contains ---)
    let headerIdx = -1
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('---') || lines[i].includes('===')) {
            headerIdx = i
            break
        }
    }
    if (headerIdx === -1) headerIdx = 0

    const headers = lines[headerIdx].split(/\s{2,}|\t/).filter(h => h.trim())
    const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim())

    const results = []
    for (const line of dataLines) {
        const values = line.split(/\s{2,}|\t/).filter(v => v.trim())
        if (values.length >= headers.length) {
            const obj = {}
            headers.forEach((h, i) => {
                obj[h.toLowerCase().replace(/\s+/g, '_')] = values[i]
            })
            results.push(obj)
        }
    }
    return results.length > 0 ? results : { error: 'Failed to parse response' }
}

// Extract finance entity from query
function extractFinanceEntity(query) {
    const q = query.toLowerCase()

    // Check for currency conversion pattern FIRST (e.g., "USD to INR", "EUR to USD")
    const currencyPairMatch = query.match(/\b([A-Z]{3})\s+(?:to|in|into)\s+([A-Z]{3})\b/i)
    if (currencyPairMatch) {
        return {
            type: 'currency',
            symbol: `${currencyPairMatch[1]}/${currencyPairMatch[2]}`,
            name: `${currencyPairMatch[1]} to ${currencyPairMatch[2]}`,
            from: currencyPairMatch[1],
            to: currencyPairMatch[2]
        }
    }

    // Check for explicit uppercase tickers FIRST (before lowercasing)
    const upperTickerMatch = query.match(/\b([A-Z]{1,5})\b/)
    if (upperTickerMatch) {
        const ticker = upperTickerMatch[1]
        // Filter out common false positives
        const falsePositives = ['THE', 'AND', 'FOR', 'YOU', 'ARE', 'BUT', 'NOT', 'HOW', 'WHAT', 'WHEN', 'WHERE', 'WHY', 'WHO', 'WITH', 'FROM', 'THIS', 'THAT', 'THEN', 'THAN', 'NOW', 'NEW', 'OLD', 'GET', 'GOT', 'HAS', 'HAD', 'CAN', 'WILL', 'WOULD', 'COULD', 'SHOULD', 'MUST', 'MAY', 'MIGHT', 'DO', 'DID', 'DOES', 'BEEN', 'BEING', 'WAS', 'WERE', 'IS', 'AM', 'ARE', 'I', 'A', 'AN', 'TO', 'IN', 'ON', 'AT', 'BY', 'OF', 'OR', 'AS', 'IF', 'SO', 'UP', 'OUT', 'OFF', 'OVER', 'UNDER', 'AGAIN', 'ONCE', 'HERE', 'THERE', 'WHERE', 'WHEN', 'WHY', 'HOW', 'ALL', 'ANY', 'SOME', 'MOST', 'MORE', 'LESS', 'FEW', 'MANY', 'MUCH', 'VERY', 'TOO', 'JUST', 'ONLY', 'EVEN', 'STILL', 'ALSO', 'WELL', 'THEN', 'NOW', 'LATER', 'SOON', 'AGO', 'TODAY', 'TOMORROW', 'YESTERDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'USA', 'UK', 'EU', 'UN', 'NASA', 'FBI', 'CIA', 'WHO', 'UNICEF', 'UNESCO', 'GDP', 'CPI', 'PMI', 'FOMC', 'ECB', 'BOE', 'BOJ', 'RBA', 'RBNZ', 'BOC', 'SNB', 'IMF', 'OECD', 'G7', 'G20', 'OPEC', 'API', 'SDK', 'IDE', 'UI', 'UX', 'AI', 'ML', 'NLP', 'CNN', 'RNN', 'LSTM', 'GPU', 'CPU', 'RAM', 'SSD', 'HDD', 'OS', 'PC', 'MAC', 'IOS', 'USB', 'HDMI', 'WIFI', 'LTE', '5G', '4G', '3G', 'IP', 'DNS', 'HTTP', 'HTTPS', 'SSL', 'TLS', 'VPN', 'SSH', 'FTP', 'SFTP', 'SMTP', 'POP3', 'IMAP', 'SQL', 'NOSQL', 'API', 'REST', 'GRAPHQL', 'JSON', 'XML', 'HTML', 'CSS', 'JS', 'TS', 'PY', 'JAVA', 'CPP', 'CS', 'GO', 'RS', 'PHP', 'RB', 'SWIFT', 'KOTLIN', 'DART', 'RUST', 'SCALA', 'CLJ', 'HS', 'ML', 'FS', 'ERL', 'EXS', 'LUA', 'PERL', 'R', 'MATLAB', 'JULIA', 'VBA', 'SQL', 'PLSQL', 'TSQL', 'MYSQL', 'PGSQL', 'MSSQL', 'ORACLE', 'DB2', 'SQLITE', 'REDIS', 'MONGO', 'CASSANDRA', 'ELASTIC', 'KAFKA', 'RABBIT', 'NATS', 'GRPC', 'PROTOBUF', 'AVRO', 'THRIFT', 'YAML', 'TOML', 'INI', 'CONF', 'ENV', 'DOCKER', 'K8S', 'KUBERNETES', 'HELM', 'TERRAFORM', 'ANSIBLE', 'CHEF', 'PUPPET', 'SALT', 'VAGRANT', 'PACKER', 'CONSUL', 'VAULT', 'NOMAD', 'ETCD', 'ZOOKEEPER', 'MESOS', 'SPARK', 'FLINK', 'STORM', 'HADOOP', 'HBASE', 'CASSANDRA', 'MONGODB', 'REDIS', 'ELASTICSEARCH', 'SOLR', 'LUCENE', 'NGINX', 'APACHE', 'TOMCAT', 'JETTY', 'IIS', 'CADDY', 'TRAEFIK', 'ENVOY', 'ISTIO', 'LINKERD', 'CONSUL', 'ETCD', 'ZOOKEEPER', 'MESOS', 'MARATHON', 'CHRONOS', 'AURORA', 'NOMAD', 'CONSUL', 'VAULT', 'BOUNDARY', 'WAYPOINT', 'PACKER', 'TERRAFORM', 'VAGRANT', 'CONSUL', 'NOMAD', 'VAULT', 'BOUNDARY', 'WAYPOINT', 'PACKER', 'TERRAFORM', 'VAGRANT', 'CONSUL', 'NOMAD', 'VAULT', 'BOUNDARY', 'WAYPOINT', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'AED', 'SAR', 'INR', 'BTC', 'ETH', 'USDT', 'XAU', 'XAG', 'XPT', 'XPD', 'WTI', 'BRENT', 'HG']
        if (!falsePositives.includes(ticker)) {
            return { type: 'stock', symbol: ticker, name: ticker }
        }
    }

    // Check for $TICKER format
    const dollarTickerMatch = query.match(/\$([A-Z]{1,5})\b/)
    if (dollarTickerMatch) {
        return { type: 'stock', symbol: dollarTickerMatch[1], name: dollarTickerMatch[0] }
    }

    // Common stock names
    const stockNames = {
        'apple': 'AAPL', 'microsoft': 'MSFT', 'google': 'GOOGL', 'amazon': 'AMZN',
        'tesla': 'TSLA', 'meta': 'META', 'nvidia': 'NVDA', 'netflix': 'NFLX',
        'reliance': 'RELIANCE.NS', 'tcs': 'TCS.NS', 'infosys': 'INFY.NS',
        'hdfc': 'HDFCBANK.NS', 'icici': 'ICICIBANK.NS', 'sbi': 'SBIN.NS',
        'tata': 'TATAMOTORS.NS', 'airtel': 'BHARTIARTL.NS', 'bajaj': 'BAJFINANCE.NS',
        'maruti': 'MARUTI.NS', 'asian paints': 'ASIANPAINT.NS', 'itc': 'ITC.NS',
        'hindustan unilever': 'HINDUNILVR.NS', 'kotak': 'KOTAKBANK.NS',
        'axis': 'AXISBANK.NS', 'larsen': 'LT.NS', 'mahindra': 'M&M.NS',
        'wipro': 'WIPRO.NS', 'tech mahindra': 'TECHM.NS', 'adani': 'ADANIENT.NS',
        'jsw': 'JSL.NS', 'vedanta': 'VEDL.NS', 'coal india': 'COALINDIA.NS',
        'ntpc': 'NTPC.NS', 'power grid': 'POWERGRID.NS', 'ongc': 'ONGC.NS',
        'bhel': 'BHEL.NS', 'sail': 'SAIL.NS', 'gail': 'GAIL.NS',
        'iocl': 'IOC.NS', 'bpcl': 'BPCL.NS', 'hpcl': 'HINDPETRO.NS'
    }

    // Currency pairs
    const currencies = {
        'usd': 'USD', 'inr': 'INR', 'eur': 'EUR', 'gbp': 'GBP', 'jpy': 'JPY',
        'cny': 'CNY', 'aud': 'AUD', 'cad': 'CAD', 'chf': 'CHF', 'sgd': 'SGD',
        'aed': 'AED', 'sar': 'SAR', 'btc': 'BTC', 'eth': 'ETH', 'usdt': 'USDT'
    }

    // Commodities
    const commodities = {
        'gold': 'XAU', 'silver': 'XAG', 'oil': 'WTI', 'crude': 'WTI',
        'brent': 'BRENT', 'copper': 'HG', 'platinum': 'XPT', 'palladium': 'XPD',
        'petrol': 'PETROL', 'gasoline': 'PETROL', 'diesel': 'DIESEL', 'fuel': 'FUEL'
    }

    // Cryptocurrencies (handle as commodity-like for price queries)
    const cryptos = {
        'bitcoin': 'BTC', 'btc': 'BTC', 'ethereum': 'ETH', 'eth': 'ETH',
        'tether': 'USDT', 'usdt': 'USDT', 'binance coin': 'BNB', 'bnb': 'BNB',
        'solana': 'SOL', 'sol': 'SOL', 'ripple': 'XRP', 'xrp': 'XRP',
        'cardano': 'ADA', 'ada': 'ADA', 'dogecoin': 'DOGE', 'doge': 'DOGE',
        'polygon': 'MATIC', 'matic': 'MATIC', 'avalanche': 'AVAX', 'avax': 'AVAX'
    }

    // Check for currencies first (to avoid "bitcoin" matching "itc" stock)
    for (const [name, code] of Object.entries(currencies)) {
        if (q.includes(name)) return { type: 'currency', symbol: code, name }
    }

    // Check for commodities
    for (const [name, code] of Object.entries(commodities)) {
        if (q.includes(name)) return { type: 'commodity', symbol: code, name }
    }

    // Check for cryptocurrencies
    for (const [name, code] of Object.entries(cryptos)) {
        if (q.includes(name)) return { type: 'crypto', symbol: code, name }
    }

    // Check for stock names (with word boundary to avoid substring matches like "bitcoin" -> "itc")
    for (const [name, ticker] of Object.entries(stockNames)) {
        const regex = new RegExp(`\\b${name.replace(/\./g, '\\.')}\\b`, 'i')
        if (regex.test(q)) return { type: 'stock', symbol: ticker, name }
    }

    return null
}

// Extract city name from weather query
function extractCity(query) {
    // Patterns: "weather in X", "temperature of X", "forecast for X", "X weather"
    const patterns = [
        /weather\s+(?:in|for|at|of)\s+([a-zA-Z\s]+)/i,
        /temperature\s+(?:in|for|at|of)\s+([a-zA-Z\s]+)/i,
        /forecast\s+(?:in|for|at|of)\s+([a-zA-Z\s]+)/i,
        /([a-zA-Z\s]+)\s+weather/i,
        /how'?s\s+(?:the\s+)?weather\s+(?:in|for|at|of)\s+([a-zA-Z\s]+)/i,
        /what'?s\s+(?:the\s+)?weather\s+(?:in|for|at|of)\s+([a-zA-Z\s]+)/i,
    ]

    for (const pattern of patterns) {
        const match = query.match(pattern)
        if (match && match[1]) {
            const city = match[1].trim()
            // Try to find closest city match for typo tolerance
            const correctedCity = findClosestCity(city)
            return correctedCity || city
        }
    }
    return null
}

// Extract city name from time query
function extractTimeCity(query) {
    // Patterns: "time in X", "time of X", "X time", "what time in X", "current time in X"
    const patterns = [
        /time\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)/i,
        /what'?s\s+the\s+time\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)/i,
        /current\s+time\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)/i,
        /time\s+zone\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)/i,
    ]

    // Words to exclude as city names
    const excludeWords = ['what', 'current', 'the', 'is', 'it', 'now', 'right', 'zone', 'today', 'date']

    for (const pattern of patterns) {
        const match = query.match(pattern)
        if (match && match[1]) {
            const city = match[1].trim().toLowerCase()
            // Check if the extracted city is not an excluded word
            if (!excludeWords.includes(city) && city.length > 1) {
                // Try to find closest city match for typo tolerance
                const correctedCity = findClosestCity(city)
                return correctedCity || city
            }
        }
    }
    return null
}

// Get timezone offset for a city (in minutes from UTC)
function getCityTimezone(city) {
    const normalized = city.toLowerCase().trim()
    const offset = CITY_TIMEZONES[normalized]
    return offset !== undefined ? offset : null
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1, str2) {
    const m = str1.length
    const n = str2.length
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,    // deletion
                    dp[i][j - 1] + 1,    // insertion
                    dp[i - 1][j - 1] + 1 // substitution
                )
            }
        }
    }
    return dp[m][n]
}

// Find closest city match from CITY_TIMEZONES
function findClosestCity(city) {
    const normalized = city.toLowerCase().trim()

    // First check exact match
    if (CITY_TIMEZONES[normalized] !== undefined) {
        return normalized
    }

    // Find closest match using Levenshtein distance
    let bestMatch = null
    let bestDistance = Infinity

    for (const knownCity of Object.keys(CITY_TIMEZONES)) {
        const distance = levenshteinDistance(normalized, knownCity)
        // Only consider matches with distance <= 2 (1-2 character differences)
        if (distance <= 2 && distance < bestDistance) {
            bestDistance = distance
            bestMatch = knownCity
        }
    }

    return bestMatch
}

// Universal fallback to Tavily search for any query when primary API fails
async function fallbackToTavily(state, query, context = "") {
    console.log("Falling back to Tavily search for:", query)
    const now = getCurrentTime()

    // Try multiple search strategies for better coverage
    const searchQueries = [
        query,
        `${query} today`,
        `${query} 2026`,
        `${query} current rate`,
    ]

    let allSources = []
    let bestQuery = query

    for (const searchQuery of searchQueries) {
        const results = await searchTool.invoke({
            query: searchQuery,
            includeImages: false,
            search_depth: "advanced",
            max_results: 8,
        })

        const sources = (results.results || []).map(r => ({
            title: r.title,
            url: r.url,
            snippet: (r.content || "").slice(0, 1500)
        }))

        if (sources.length > allSources.length) {
            allSources = sources
            bestQuery = searchQuery
        }

        // If we have enough sources, stop searching
        if (sources.length >= 5) break
    }

    const compact = {
        query: bestQuery,
        images: [],
        sources: allSources
    }

    if (compact.sources.length > 0) {
        console.log("Tavily fallback found", compact.sources.length, "sources using query:", bestQuery)
        const llm = await getModel("search")
        const prompt = `You are an assistant. The user asked: ${query}

CURRENT TIME (server time):
Date: ${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}
Time: ${String(now.hours).padStart(2, "0")}:${String(now.minutes).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")} (${now.utc})

SEARCH RESULTS:
${JSON.stringify(compact, null, 2)}

RULES:
1. Answer the query directly using ONLY the search results above.
2. Be concise and easy to understand.
3. If results don't contain the answer, say so clearly.
4. Do NOT include raw JSON or metadata in the text.`

        const content = await askLLM(llm, prompt, "I couldn't find information for that query. Please try a more specific query.")
        return {
            ...state,
            searchResults: compact,
            images: [],
            aiResponse: content
        }
    }
    return null
}

// ---------- Shared LLM caller ----------
async function askLLM(llm, promptText, fallbackText) {
    try {
        const response = await llm.invoke(promptText)
        const content = Array.isArray(response.content)
            ? response.content.map(block => block.text || "").join("")
            : response.content
        return content?.trim() || fallbackText
    } catch (err) {
        // Re-throw token limit errors so they propagate to the controller
        if (isTokenLimitError(err)) {
            throw err
        }
        console.error("LLM call failed:", err)
        return fallbackText
    }
}

// ---------- Search with fallback ----------
async function runSearch(query, wantsImages, isLinkRequest, imageCount, tool = searchTool) {
    const primary = await tool.invoke({
        query,
        includeImages: wantsImages,
        search_depth: "advanced",
        max_results: 8,
    })

    let compact = {
        query: primary.query,
        images: wantsImages ? (primary.images || []).slice(0, imageCount) : [],
        sources: (primary.results || []).map(r => ({
            title: r.title,
            url: r.url,
            snippet: (r.content || "").slice(0, 1500)
        }))
    }

    const needsFallback = (wantsImages && compact.images.length === 0) ||
        (compact.sources.length === 0)

    if (needsFallback) {
        const broaderQuery = query.replace(/\s*site:\S+/g, "").trim()
        if (broaderQuery !== query) {
            const retry = await tool.invoke({
                query: broaderQuery,
                includeImages: wantsImages,
                search_depth: "advanced",
                max_results: 8,
            })
            compact = {
                query: retry.query,
                images: wantsImages ? (retry.images || []).slice(0, imageCount) : [],
                sources: (retry.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: (r.content || "").slice(0, 1500)
                }))
            }
        }
    }

    // SECOND FALLBACK: if still no images but user wants them, try an
    // image-specific query (e.g. "who is X" -> "X photos images").
    if (wantsImages && compact.images.length === 0) {
        const imgQuery = `${query} photo picture images`
        try {
            const imgRetry = await tool.invoke({
                query: imgQuery,
                includeImages: true,
                search_depth: "advanced",
                max_results: 8,
            })
            if (imgRetry.images && imgRetry.images.length > 0) {
                compact.images = imgRetry.images.slice(0, imageCount)
            }
            // Also merge any new sources we found
            if (imgRetry.results && imgRetry.results.length > 0) {
                const existing = new Set(compact.sources.map(s => s.url))
                const merged = compact.sources.slice()
                for (const r of imgRetry.results) {
                    if (!existing.has(r.url)) {
                        merged.push({
                            title: r.title,
                            url: r.url,
                            snippet: (r.content || "").slice(0, 1500)
                        })
                    }
                }
                compact.sources = merged.slice(0, 8)
            }
        } catch (e) {
            console.error("Image fallback search failed:", e)
        }
    }

    return compact
}

// ---------- Main agent ----------
export const searchAgent = async (state) => {
    try {
        const now = getCurrentTime()
        const q = (state.prompt || "").toLowerCase()
        // ========================================================
        // GITHUB MCP ROUTING
        // ========================================================

        if (await isGitHubRequest(state.prompt, state.conversationId)) {
            let githubResult
            try {
                console.log("🐙 GitHub MCP request:", state.prompt)

                githubResult = await runGitHubQuery(
                    state.prompt,
                    state.conversationId
                )
            } catch (githubError) {
                // FIX 7 & FIX 10: Differentiate error types
                console.error("GitHub MCP ERROR:", githubError)

                if (isRateLimitError(githubError)) {
                    const retryTime = retryAfterText(githubError)
                    const lang = detectLanguage(state.prompt)
                    const rateLimitMsg = {
                        English: `AI model ka token limit abhi khatam hai. Kuch der baad (${retryTime}) try karo.`,
                        Hindi: `एआई मॉडल का टोकन लिमिट अभी ख़त्म है। कुछ देर बाद (${retryTime}) फिर कोशिश करें।`,
                        Hinglish: `AI model ka token limit abhi khatam hai. ${retryTime} baad try karo.`,
                    }
                    const msg = rateLimitMsg[lang] || rateLimitMsg.English

                    return {
                        ...state,
                        searchResults: {
                            query: state.prompt,
                            images: [],
                            sources: [],
                            github: { error: "rate_limit", retryAfter: retryTime },
                        },
                        images: [],
                        aiResponse: msg,
                    }
                }

                const lang = detectLanguage(state.prompt)
                const connErrorMsg = {
                    English: "GitHub MCP connection failed, check token",
                    Hindi: "GitHub MCP कनेक्शन विफल, टोकन जाँचें",
                    Hinglish: "GitHub MCP connection failed, token check karo",
                }

                return {
                    ...state,
                    searchResults: {
                        query: state.prompt,
                        images: [],
                        sources: [],
                        github: { error: "connection" },
                    },
                    images: [],
                    aiResponse: connErrorMsg[lang] || connErrorMsg.English,
                }
            }

            // FIX 8: Direct formatter for simple data (no LLM call needed)
            const language = detectLanguage(state.prompt)
            const isSimpleResult = (
                githubResult.tool === "search_repositories" ||
                githubResult.tool === "list_commits" ||
                githubResult.tool === "list_branches" ||
                githubResult.tool === "list_releases" ||
                githubResult.tool === "list_issues" ||
                githubResult.tool === "search_issues" ||
                githubResult.tool === "list_pull_requests" ||
                githubResult.tool === "search_pull_requests"
            )

            // For repository tree, we can also format directly
            const isTreeResult = (
                githubResult.tool === "get_file_contents" &&
                githubResult.path === "(recursive tree)"
            )

            // FIX 15: Token optimization — use direct formatter for simple results
            // instead of calling LLM for every response
            if (isSimpleResult || isTreeResult) {
                let directFormatted = formatGitHubDirect(githubResult, language)

                // If direct formatter couldn't handle it, use raw data
                if (!directFormatted) {
                    const lang = detectLanguage(state.prompt) || "English"
                    directFormatted = `${githubResult.data || "No data available."}`
                }

                // FIX 10: Return the formatted result directly without LLM
                return {
                    ...state,
                    searchResults: {
                        query: state.prompt,
                        images: [],
                        sources: [],
                        github: {
                            tool: githubResult.tool,
                            repository: githubResult.repository,
                            user: githubResult.user,
                        },
                    },
                    images: [],
                    aiResponse: directFormatted,
                }
            }

            // For complex requests (file contents, code explanations, etc.), use LLM
            const MAX_GH_CHARS = 12000
            let githubData = githubResult.data || ""
            let truncated = false
            if (githubData.length > MAX_GH_CHARS) {
                githubData = githubData.slice(0, MAX_GH_CHARS) + "\n\n...[truncated]..."
                truncated = true
            }

            const llm = await getModel("search")
            const detectedLanguage = language

            const githubPrompt = `You are a GitHub-aware AI assistant.

The user asked:
${state.prompt}

GitHub MCP tool used:
${githubResult.tool}

${githubResult.repository ? `Repository:\n${githubResult.repository}\n\n` : ""}
${githubResult.user ? `GitHub user:\n${githubResult.user}\n\n` : ""}
GitHub MCP result:
${truncated ? githubData + "\n\n[NOTE: Result was truncated to fit model limits. This may cause incomplete information.]" : githubData}

RESPOND IN: ${detectedLanguage}
The user's query is in ${detectedLanguage}. Respond in the same language and style — use natural Hinglish or Hindi if the query is in Hinglish/Hindi, and English if the query is in English.

RULES:
1. Answer using ONLY the GitHub MCP result.
2. Do not invent repository files, code, commits, issues, or facts.
3. Clearly say when the GitHub result does not contain enough information.
4. If code is present, explain it accurately.
5. Keep the answer concise and useful.
6. Do not expose API tokens or authentication information.
7. Do not claim that you changed anything unless a write tool was actually used.`

            let githubAnswer
            try {
                githubAnswer = await askLLM(
                    llm,
                    githubPrompt,
                    "I connected to GitHub, but I couldn't generate a clear answer from the repository data."
                )

                // FIX 7 & FIX 10: Handle LLM rate limit during answer generation
                // If this throws a 429, catch it and return raw data instead
            } catch (llmError) {
                // FIX 10: If GitHub MCP succeeded but LLM answer generation failed,
                // return the GitHub data directly when possible
                if (isRateLimitError(llmError)) {
                    const retryTime = retryAfterText(llmError)
                    const lang = detectedLanguage || "English"
                    const rateLimitMsg = {
                        English: `AI generation limit reached. ${retryTime} baad try karo.\n\nGitHub data:\n${githubData.slice(0, 2000)}`,
                        Hindi: `AI जनरेशन सीमा पार हुई। ${retryTime} बाद फिर कोशिश करें।\n\nGitHub डेटा:\n${githubData.slice(0, 2000)}`,
                        Hinglish: `AI generation limit reached. ${retryTime} baad try karo.\n\nGitHub data:\n${githubData.slice(0, 2000)}`,
                    }
                    githubAnswer = rateLimitMsg[lang] || rateLimitMsg.English
                } else {
                    // For non-rate-limit LLM errors, return raw data
                    githubAnswer = `GitHub data:\n${githubData.slice(0, 2000)}`
                }
            }

            return {
                ...state,
                searchResults: {
                    query: state.prompt,
                    images: [],
                    sources: [],
                    github: {
                        tool: githubResult.tool,
                        repository: githubResult.repository,
                        user: githubResult.user,
                    },
                },
                images: [],
                aiResponse: githubAnswer,
            }
        }

        // ========================================================
        // NORMAL INTENT DETECTION
        // ========================================================

        const {
            isImageRequest,
            wantsImages,
            isLinkRequest,
            isTimeRequest,
            isNewsRequest,
            isWeatherRequest,
            isSportsRequest,
            isFinanceRequest
        } = detectIntent(q)

        const explicitCount = extractImageCount(state.prompt, isImageRequest)
        // Priority: explicit number > "images" asked with no number (10) >
        // general query (8 images auto-attached) > fallback (4).
        const requestedImageCount = explicitCount ?? (isImageRequest ? 10 : 8)

        const query = (wantsImages && isImageRequest)
            ? `${state.prompt} site:instagram.com OR site:flickr.com OR site:wikipedia.org OR site:commons.wikimedia.org`
            : isNewsRequest
                ? `${state.prompt} latest news current`   // bias toward fresh results
                : state.prompt

        const timeHeader = `CURRENT TIME (server time):
Date: ${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}
Time: ${String(now.hours).padStart(2, "0")}:${String(now.minutes).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")} (${now.utc})
Timezone: ${now.timezoneName || "UTC" + now.timezoneOffset}`

        // --- TIME REQUEST ---
        if (isTimeRequest) {
            // Check if user asked for time in a specific city
            const timeCity = extractTimeCity(state.prompt)
            let targetTime = now
            let targetTimezoneName = ""
            let targetTimezoneOffset = ""

            if (timeCity) {
                const cityOffset = getCityTimezone(timeCity)
                if (cityOffset !== null) {
                    // Calculate time in target city
                    const utcTime = new Date(now.iso)
                    const targetMs = utcTime.getTime() + cityOffset * 60 * 1000
                    const targetDate = new Date(targetMs)

                    targetTime = {
                        ...now,
                        year: targetDate.getUTCFullYear(),
                        month: targetDate.getUTCMonth() + 1,
                        day: targetDate.getUTCDate(),
                        hours: targetDate.getUTCHours(),
                        minutes: targetDate.getUTCMinutes(),
                        seconds: targetDate.getUTCSeconds(),
                        dayOfWeek: targetDate.getUTCDay(),
                    }

                    const sign = cityOffset >= 0 ? "+" : "-"
                    const abs = Math.abs(cityOffset)
                    const tzHours = Math.floor(abs / 60)
                    const tzMinutes = abs % 60
                    targetTimezoneOffset = `${sign}${String(tzHours).padStart(2, "0")}:${String(tzMinutes).padStart(2, "0")}`
                    targetTimezoneName = timeCity.charAt(0).toUpperCase() + timeCity.slice(1) + " (UTC" + targetTimezoneOffset + ")"
                }
            }

            // Fallback to server time if no city specified or city not found
            if (!targetTimezoneName) {
                targetTimezoneName = now.timezoneName || "UTC" + now.timezoneOffset
                const sign = now.timezoneOffset <= 0 ? "+" : "-"
                const abs = Math.abs(now.timezoneOffset)
                const tzHours = Math.floor(abs / 60)
                const tzMinutes = abs % 60
                targetTimezoneOffset = `${sign}${String(tzHours).padStart(2, "0")}:${String(tzMinutes).padStart(2, "0")}`
            }

            const dateStr = `${DAYS[targetTime.dayOfWeek]}, ${MONTHS[targetTime.month - 1]} ${targetTime.day}, ${targetTime.year}`
            const h12 = targetTime.hours % 12 || 12
            const ampm = targetTime.hours >= 12 ? "PM" : "AM"
            return {
                ...state,
                searchResults: { query: state.prompt, images: [], sources: [] },
                images: [],
                aiResponse: `Current time in ${timeCity ? timeCity.charAt(0).toUpperCase() + timeCity.slice(1) : "your location"}: ${h12}:${String(targetTime.minutes).padStart(2, "0")} ${ampm} (${String(targetTime.hours).padStart(2, "0")}:${String(targetTime.minutes).padStart(2, "0")}:${String(targetTime.seconds).padStart(2, "0")})\nDate: ${dateStr}\nTime zone: ${targetTimezoneName}`
            }
        }

        // --- WEATHER REQUEST ---
        if (isWeatherRequest) {
            const city = extractCity(state.prompt)
            if (!city) {
                return {
                    ...state,
                    searchResults: { query: state.prompt, images: [], sources: [] },
                    images: [],
                    aiResponse: "Please specify a city name. For example: 'weather in London' or 'temperature in New York'."
                }
            }

            const weather = await fetchWeather(city)
            if (weather.error) {
                return {
                    ...state,
                    searchResults: { query: state.prompt, images: [], sources: [] },
                    images: [],
                    aiResponse: `Weather error: ${weather.error}`
                }
            }

            const c = weather.current
            const f = weather.forecast

            // Build current weather summary
            const temp = Math.round(c.main.temp)
            const feels = Math.round(c.main.feels_like)
            const humidity = c.main.humidity
            const wind = Math.round(c.wind.speed)
            const desc = c.weather[0].description
            const icon = c.weather[0].icon
            const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`

            // Build forecast summary (next 24 hours, every 3 hours)
            let forecastSummary = ""
            if (f && f.list) {
                const next24h = f.list.slice(0, 8).map(item => {
                    const dt = new Date(item.dt * 1000)
                    const t = Math.round(item.main.temp)
                    const d = item.weather[0].description
                    return `${dt.getHours()}:00 - ${t} deg C, ${d}`
                })
                forecastSummary = `\n\nNext 24 hours:\n${next24h.join("\n")}`
            }

            const weatherText = `**Weather in ${city}**\n- **${temp} deg C** (feels like ${feels} deg C), ${desc}\n- Humidity: ${humidity}%\n- Wind: ${wind} m/s${forecastSummary}`

            return {
                ...state,
                searchResults: { query: state.prompt, images: [iconUrl], sources: [] },
                images: [iconUrl],
                aiResponse: weatherText
            }
        }

        // --- FINANCE REQUEST (API Ninjas) ---
        if (isFinanceRequest) {
            const entity = extractFinanceEntity(state.prompt)
            if (!entity) {
                return {
                    ...state,
                    searchResults: { query: state.prompt, images: [], sources: [] },
                    images: [],
                    aiResponse: "Please specify a stock, currency, or commodity. For example: 'Apple stock price', 'USD to INR exchange rate', 'gold price', 'bitcoin price', 'crude oil price'."
                }
            }

            let financeData = null
            let financeText = ""
            let financeImages = []

            if (entity.type === 'stock') {
                financeData = await fetchFinanceData("stockprice", { ticker: entity.symbol })
                if (financeData && !financeData.error) {
                    const stock = financeData
                    const changePct = stock.previous_close ? ((stock.price - stock.previous_close) / stock.previous_close * 100).toFixed(2) : 'N/A'
                    financeText = `**${stock.name || entity.name} (${stock.ticker || entity.symbol})**\n- **Price:** $${stock.price}\n- **Change:** ${stock.change >= 0 ? '+' : ''}${stock.change} (${changePct}%)\n- **Previous Close:** $${stock.previous_close}\n- **Volume:** ${stock.volume?.toLocaleString() || 'N/A'}\n- **Exchange:** ${stock.exchange}\n- **Currency:** ${stock.currency}\n- **Timestamp:** ${new Date(stock.updated * 1000).toLocaleString()}`
                } else {
                    const stockFallback = await fallbackToTavily(state, state.prompt)
                    if (stockFallback) return stockFallback
                }
            } else if (entity.type === 'currency') {
                // Currency conversion is premium only on API Ninjas, fall back to Tavily search
                console.log("Currency conversion - falling back to Tavily search...")
                const currencyQuery = `${state.prompt} exchange rate`
                const currencyResults = await searchTool.invoke({
                    query: currencyQuery,
                    includeImages: false,
                    search_depth: "advanced",
                    max_results: 5,
                })

                const currencyCompact = {
                    query: currencyResults.query,
                    images: [],
                    sources: (currencyResults.results || []).map(r => ({
                        title: r.title,
                        url: r.url,
                        snippet: (r.content || "").slice(0, 1500)
                    }))
                }

                if (currencyCompact.sources.length > 0) {
                    const llm = await getModel("search")
                    const currencyPrompt = `You are a finance assistant. The user asked for currency exchange rate.

CURRENT TIME (server time):
Date: ${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}
Time: ${String(now.hours).padStart(2, "0")}:${String(now.minutes).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")} (${now.utc})

SEARCH RESULTS:
${JSON.stringify(currencyCompact, null, 2)}

USER QUERY:
${state.prompt}

RULES:
1. Answer the currency conversion query directly using ONLY the search results above.
2. Provide the current exchange rate if available.
3. Be concise and easy to understand.
4. If results don't contain the answer, say so clearly.
5. Do NOT include raw JSON or metadata in the text.`

                    const currencyContent = await askLLM(llm, currencyPrompt, "I couldn't find current exchange rate for that currency pair. Please try a more specific query.")
                    return {
                        ...state,
                        searchResults: currencyCompact,
                        images: [],
                        aiResponse: currencyContent
                    }
                }
            } else if (entity.type === 'commodity') {
                if (entity.symbol === 'XAU' || entity.name.includes('gold')) {
                    console.log("Fetching gold price...")
                    financeData = await fetchFinanceData("goldprice", {})
                    console.log("Gold price response:", financeData)
                    if (financeData && !financeData.error && (Array.isArray(financeData) ? financeData.length > 0 : financeData.price)) {
                        const gold = Array.isArray(financeData) ? financeData[0] : financeData
                        financeText = `**Gold Price**\n- **Price:** $${gold.price} per ${gold.unit || 'troy_ounce'}\n- **Currency:** ${gold.currency_unit || 'USD'}\n- **Timestamp:** ${new Date(gold.updated * 1000).toLocaleString()}`
                    } else {
                        const goldFallback = await fallbackToTavily(state, state.prompt)
                        if (goldFallback) return goldFallback
                    }
                } else if (entity.symbol === 'XAG' || entity.name.includes('silver')) {
                    console.log("Fetching silver price...")
                    financeData = await fetchFinanceData("silverprice", {})
                    console.log("Silver price response:", financeData)
                    if (financeData && !financeData.error && (Array.isArray(financeData) ? financeData.length > 0 : financeData.price)) {
                        const silver = Array.isArray(financeData) ? financeData[0] : financeData
                        financeText = `**Silver Price**\n- **Price:** $${silver.price} per ${silver.unit || 'troy_ounce'}\n- **Currency:** ${silver.currency_unit || 'USD'}\n- **Timestamp:** ${new Date(silver.updated * 1000).toLocaleString()}`
                    } else {
                        const silverFallback = await fallbackToTavily(state, state.prompt)
                        if (silverFallback) return silverFallback
                    }
                } else if (entity.symbol === 'WTI' || entity.name.includes('oil')) {
                    console.log("Fetching oil price...")
                    financeData = await fetchFinanceData("oilprice", {})
                    console.log("Oil price response:", financeData)
                    if (financeData && !financeData.error) {
                        const oil = financeData
                        financeText = `**${oil.name || 'Crude Oil (WTI)'} Price**\n- **Price:** $${oil.price} per ${oil.unit || 'barrel'}\n- **Change (24h):** ${oil.change_24h >= 0 ? '+' : ''}${oil.change_24h} (${oil.change_24h_percent >= 0 ? '+' : ''}${oil.change_24h_percent}%)\n- **Previous Close:** $${oil.previous_close}\n- **Currency:** ${oil.currency_unit}\n- **Timestamp:** ${new Date(oil.updated * 1000).toLocaleString()}`
                    } else {
                        const oilFallback = await fallbackToTavily(state, state.prompt)
                        if (oilFallback) return oilFallback
                    }
                } else if (entity.symbol === 'PETROL' || entity.name.includes('petrol') || entity.name.includes('gasoline') || entity.name.includes('diesel') || entity.name.includes('fuel')) {
                    // Petrol/diesel/fuel prices - use Tavily search with original query for city specificity
                    console.log("Fuel price - falling back to Tavily search...")
                    const fuelFallback = await fallbackToTavily(state, state.prompt)
                    if (fuelFallback) return fuelFallback
                }
            } else if (entity.type === 'crypto') {
                // Crypto price - fall back to Tavily search since API Ninjas doesn't have crypto endpoint
                console.log("Crypto price - falling back to Tavily search...")
                const cryptoFallback = await fallbackToTavily(state, state.prompt)
                if (cryptoFallback) return cryptoFallback
            }

            if (!financeText && financeData?.error) {
                return {
                    ...state,
                    searchResults: { query: state.prompt, images: [], sources: [] },
                    images: [],
                    aiResponse: `Finance API error: ${financeData.error}`
                }
            }

            if (!financeText) {
                return {
                    ...state,
                    searchResults: { query: state.prompt, images: [], sources: [] },
                    images: [],
                    aiResponse: `I couldn't fetch finance data for "${entity.name}". Try a different symbol or check the spelling.`
                }
            }

            return {
                ...state,
                searchResults: { query: state.prompt, images: financeImages, sources: [] },
                images: financeImages,
                aiResponse: financeText
            }
        }

        // --- SPORTS REQUEST: use Tavily search for live sports data ---
        if (isSportsRequest) {
            // Bias the search query for sports to get fresh, live data
            const sportsQuery = `${state.prompt} ${isNewsRequest ? "latest" : ""} live score today`
            const sportsResults = await searchTool.invoke({
                query: sportsQuery,
                includeImages: true,
                search_depth: "advanced",
                max_results: 8,
            })

            const sportsCompact = {
                query: sportsResults.query,
                images: (sportsResults.images || []).slice(0, requestedImageCount),
                sources: (sportsResults.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    snippet: (r.content || "").slice(0, 1500)
                }))
            }

            if (sportsCompact.sources.length === 0 && sportsCompact.images.length === 0) {
                return {
                    ...state,
                    searchResults: { query: state.prompt, images: [], sources: [] },
                    images: [],
                    aiResponse: `I couldn't find live sports data for "${state.prompt}". Try a more specific query like 'Manchester United vs Liverpool live score' or 'Premier League standings'.`
                }
            }

            const llm = await getModel("search")
            const sportsPrompt = `You are a sports assistant. The user asked for live sports information.

CURRENT TIME (server time):
Date: ${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}
Time: ${String(now.hours).padStart(2, "0")}:${String(now.minutes).padStart(2, "0")}:${String(now.seconds).padStart(2, "0")} (${now.utc})

SEARCH RESULTS:
${JSON.stringify(sportsCompact, null, 2)}

USER QUERY:
${state.prompt}

RULES:
1. Answer the sports query directly using ONLY the search results above.
2. Provide live scores, standings, fixtures, or results as requested.
3. Include specific scores, match times, team names, and league names.
4. Be concise and easy to understand.
5. Use simple language.
6. If results don't contain the answer, say so clearly.
7. Do NOT include raw JSON or metadata in the text.`

            const sportsContent = await askLLM(llm, sportsPrompt, "I couldn't find live sports data for that query. Please try a more specific query.")
            return {
                ...state,
                searchResults: sportsCompact,
                images: sportsCompact.images,
                aiResponse: sportsContent
            }
        }

        const compact = await runSearch(query, wantsImages, isLinkRequest, requestedImageCount)

        const llm = await getModel("search")

        // --- LINK / ARTICLE REQUEST ---
        if (isLinkRequest && compact.sources.length > 0) {
            const linkPrompt = `You are a search assistant. The user asked for links/articles.

${timeHeader}

SEARCH RESULTS:
${JSON.stringify(compact, null, 2)}

USER QUERY:
${state.prompt}

RULES:
1. List the actual article URLs from the search results — do NOT invent or rewrite them.
2. For each link include: title + one-line description.
3. Use a simple numbered or bulleted list.
4. No source-by-source comparison or meta-analysis.
5. No raw JSON or metadata in the text.
6. Keep it concise.`
            const linkContent = await askLLM(llm, linkPrompt, "I found some results but couldn't summarize them right now. Please try again.")
            return { ...state, searchResults: compact, images: compact.images, aiResponse: linkContent }
        }

        // --- EXPLICIT IMAGE REQUEST ("show me images of X", "5 photos of Y") ---
        if (isImageRequest && wantsImages && compact.images.length > 0) {
            const imagePrompt = `You are a search assistant. The user asked for ${requestedImageCount} images of a topic.

${timeHeader}

SEARCH RESULTS:
${JSON.stringify(compact, null, 2)}

USER QUERY:
${state.prompt}

RULES:
- Use ONLY facts from the search results. Do NOT invent anything.
- Max 2 short paragraphs: what/where/when/who/why it matters.
- Simple language, no URLs/JSON in text, no comparison/meta-analysis.
- End with exactly: "Images related to your query are shown below."`
            const imageContent = await askLLM(llm, imagePrompt, `Here are images related to "${state.prompt}".\n\nImages related to your query are shown below.`)
            return { ...state, searchResults: compact, images: compact.images, aiResponse: imageContent }
        }

        if (isImageRequest && wantsImages && compact.images.length === 0) {
            return {
                ...state,
                searchResults: compact,
                images: [],
                aiResponse: `Maine "${state.prompt}" ke liye images search kiye, lekin koi accha match nahi mila. Try a more specific query?`
            }
        }

        // --- NORMAL TEXT QUESTION (images auto-attached in background) ---
        const prompt = `You are a search assistant. Answer the user's question using ONLY the search results below.

${timeHeader}

SEARCH RESULTS:
${JSON.stringify(compact, null, 2)}

USER QUERY:
${state.prompt}

RULES:
1. Answer directly using ONLY facts from the results. No invented info.
2. Be concise, simple language, most important info first.
3. Short headings/bullets/tables only if they add clarity.
4. No source-by-source comparison unless explicitly asked.
5. No raw JSON, URLs, or image links in the text.
6. If results don't answer the question, say so briefly.
7. Do NOT mention images in the text — they are shown separately by the UI.`
        const content = await askLLM(llm, prompt, "I found some results but couldn't generate a clear answer. Please try rephrasing your question.")

        return { ...state, searchResults: compact, images: compact.images, aiResponse: content }
    } catch (error) {
        // Re-throw token limit errors so they propagate to the controller
        if (isTokenLimitError(error)) {
            throw error
        }
        console.error("SEARCH AGENT ERROR:", error)
        console.error("ERROR STACK:", error.stack)
        console.error("STATE:", JSON.stringify({ prompt: state?.prompt, agent: state?.agent }))
        return {
            ...state,
            searchResults: { query: state?.prompt || "", images: [], sources: [] },
            images: [],
            aiResponse: "I couldn't complete that search. Please try again."
        }
    }
}
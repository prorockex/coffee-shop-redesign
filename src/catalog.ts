export type BagSize = 'half' | 'one'
export type InventoryStatus = 'listed' | 'review'

export const ROAST_LEVELS = ['淺焙', '中焙', '深焙'] as const
export type RoastLevel = (typeof ROAST_LEVELS)[number]

export function isRoastLevel(value: unknown): value is RoastLevel {
  return ROAST_LEVELS.some((level) => level === value)
}

export type Product = {
  id: string
  name: string
  origin: string
  bean?: string
  process: string
  flavor: string
  priceHalf: number
  priceOne: number
  inventoryStatus: InventoryStatus
}

export type CartLine = { productId: string; size: BagSize; quantity: number; roastLevel: RoastLevel }

export const products: Product[] = [
  { id: 'ethiopia-angel-geisha', name: '衣索比亞 天使藝妓', origin: '衣索比亞', bean: '藝妓', process: '水洗', flavor: '杏桃、白花、蘋果、紅莓、甜橙', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-guji-shakiso-g1', name: '衣索比亞 古吉 夏奇索 G1', origin: '衣索比亞', bean: '古吉', process: '日曬', flavor: '花香、蔗糖、莓果、桃子、柑橘', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-sidamo-flor-begonia', name: '衣索比亞 西達摩 花貝果娜', origin: '衣索比亞', bean: '西達摩', process: '日曬', flavor: '熱帶果汁、覆盆子、荔枝杏桃、野薑花、玫瑰香氣。', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-jasmine-yuzu-white-honey', name: '衣索比亞 茉香柚 白蜜處理', origin: '衣索比亞', process: '白蜜處理', flavor: '茉莉花、白柚、白葡萄、柑橘果肉、甜橙', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-gembo-geisha-washed', name: '衣索比亞 金寶藝妓 水洗', origin: '衣索比亞', bean: '金寶藝妓', process: '水洗', flavor: '帶有雞蛋花、葡萄、肉桂、小白花、黑醋栗等香氣，餘韻可能帶有紅茶香。', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'kenya-aa-faq', name: '肯亞 AA FAQ', origin: '肯亞', process: '水洗', flavor: '烏梅、烏梅酒香、黑醋栗尾韻、厚實口感、酸甜感佳', priceHalf: 330, priceOne: 650, inventoryStatus: 'listed' },
  { id: 'kenya-ab-top-honey-riruni', name: '肯亞 AB TOP 蜂蜜 浬里產區', origin: '肯亞', process: '水洗', flavor: '檸檬、柑橘香氣，入口感受烏梅、黑糖滑順口感，尾韻甘甜細緻。', priceHalf: 340, priceOne: 670, inventoryStatus: 'listed' },
  { id: 'ethiopia-black-knight', name: '衣索比亞 黑騎村', origin: '衣索比亞', process: '水洗', flavor: '乾香帶有橙花清香，品飲撲鼻而至的佛手柑與萊姆，伴隨黑李、紅柚，整體酸甜平衡，尾韻延綿。', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'rwanda-rilindo-city-of-sky', name: '盧安達 如霖朵 天空之城', origin: '盧安達', process: '水洗', flavor: '淡雅花香、莓果、梅子、黃金糖；原資料另載 2024 Best of Rwanda 競標賽第二名、90.86 分。', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'costa-rica-mango-estate', name: '哥斯大黎加布蘭卡奇里波山谷里瓦斯人處理廠芒果莊園', origin: '哥斯大黎加', process: '水洗', flavor: '乾香帶有紅色莓果、柑橘；品飲時有紅莓果、葡萄、柑橘、烤堅果、水果硬糖、烏龍茶，水果感十足、甜感佳', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-sidama-miying', name: '衣索比亞 西達摩 霓映莓果', origin: '衣索比亞', process: '日曬', flavor: '乾香氣帶豐富的綜合莓果香氣，前段是明亮柳橙酸質，果汁感佳、甜感明確且集中，整體口感絲滑圓潤，尾韻乾淨持久', priceHalf: 370, priceOne: 730, inventoryStatus: 'listed' },
  { id: 'guatemala-shb-huehuetenango', name: '瓜地馬拉 SHB 薇薇特南果', origin: '瓜地馬拉', process: '水洗', flavor: '牛奶巧克力、核果、奶油、柑橘、淡雅花香；甜度高，酸值平衡', priceHalf: 330, priceOne: 650, inventoryStatus: 'listed' },
  { id: 'colombia-huila-rainforest', name: '哥倫比亞 微拉 雨林認證', origin: '哥倫比亞', process: '水洗', flavor: '巧克力甜雪糕、甘蔗、柳橙、堅果、白柚、黑巧克力、黑櫻桃', priceHalf: 330, priceOne: 650, inventoryStatus: 'review' },
  { id: 'indonesia-east-java-blue-geisha', name: '印尼 東瓜哇 藍藝伎', origin: '印尼', process: '水洗', flavor: '柑橘、果汁、仙草，乾淨度佳', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-buku-sheisha', name: '衣索比亞 布穀雪伊莎', origin: '衣索比亞', process: '水洗', flavor: '花香、香草、蜂蜜甜美、黑孜然、漿果、百香果；明亮酸質，口感厚實滑順，餘韻悠長', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-guji-hambela-goro-g1', name: '衣索比亞 古吉 罕貝拉 果洛 G1', origin: '衣索比亞', process: '蜜處理', flavor: '乾香中，草莓、水蜜桃與淡花香的組合為這杯咖啡帶來初春氣息。啜吸時，草莓和水蜜桃搭配藍莓、佛手柑以及輕盈花香', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-yirgacheffe-biloya', name: '衣索匹亞 耶加區 畢洛亞', origin: '衣索比亞', process: '水洗處理', flavor: '甜桃香氣、蜂蜜甜感、莓果果茶', priceHalf: 350, priceOne: 690, inventoryStatus: 'review' },
  { id: 'ethiopia-sidama-white-butterfly', name: '衣索匹亞 西達摩 白玉蝶', origin: '衣索比亞', process: '水洗', flavor: '乾香為白花香；品飲有葡萄柚、柑橘、蜂蜜、熱帶水果風味，層次細膩', priceHalf: 350, priceOne: 690, inventoryStatus: 'review' },
  { id: 'ethiopia-baby-geisha', name: '衣索比亞 寶貝 藝妓 水洗', origin: '衣索比亞', process: '水洗', flavor: '橙花、蜂蜜、藍莓、葡萄、野莓；酸值柔和，甜度高且口感乾淨厚實', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-lucy-geisha', name: '衣索比亞 露西 藝妓 水洗', origin: '衣索比亞', process: '水洗', flavor: '接骨木花、茉莉花、橙花、白玫瑰、百合花、蘋果、野莓果醬、檸檬、百香果', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-guji-bedesha', name: '衣索比亞 古吉 罕貝拉 貝德莎處理廠', origin: '衣索比亞', process: '水洗', flavor: '前調優雅茉莉花香、橙花；中段甜檸檬、白桃甜味；後段蜂蜜清甜滑順且層次平衡', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-guji-uraga-tipoboka', name: '衣索比亞 古吉 烏拉嘎 提波波卡處理廠', origin: '衣索比亞', process: '水洗', flavor: '強烈白花香與柑橘香，尾韻帶紅茶或香草氣息', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'kenya-riyeri-queen-blackberry', name: '肯亞 冽里 烏克栗栗／黑莓皇后 PB TOP', origin: '肯亞', process: '水洗', flavor: '乾香為黑醋栗、黑莓、烏梅及仙楂香氣；入口有煙燻烏梅、黑醋栗軟糖、黑莓，隨後浮現仙楂與雪松香氣，口感厚實綿密、酸質俐落多汁', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-oromia-jimalim', name: '衣索比亞 歐若米雅 吉瑪莉姆', origin: '衣索比亞', process: '水洗', flavor: '白花清香、檸檬花香、明亮萊姆果酸、帶有紅糖甜感，口感溫和且平衡感佳', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'colombia-narino-floral-geisha', name: '哥倫比亞 娜玲瓏 花境 藝妓', origin: '哥倫比亞', process: '水洗', flavor: '茉莉花、薰衣草、百香果、水蜜桃、檸檬草、綠茶、棉花糖', priceHalf: 380, priceOne: 750, inventoryStatus: 'listed' },
  { id: 'ethiopia-bench-maji-sparrow-geisha', name: '衣索比亞 班奇馬吉 飛雀 藝妓 紅圈計畫', origin: '衣索比亞', process: '日曬', flavor: '芒果、百香果、濃郁的果醬感、蜂蜜甜香、尾韻帶有細緻的果汁感', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
  { id: 'ethiopia-bastet-geisha-2026', name: '衣索比亞 2026 芭絲特 藝伎 紅圈計畫', origin: '衣索比亞', process: '水洗', flavor: '葡萄、柑橘、檸檬、甜柚、牡丹花', priceHalf: 350, priceOne: 690, inventoryStatus: 'listed' },
]

// Static catalog: used only to fill missing fields of sheet rows by name. Listing comes from the Products sheet column I.

export function filterProducts(items: Product[], query: string): Product[] {
  const needle = query.trim().toLocaleLowerCase('zh-TW')
  if (!needle) return items
  return items.filter((product) =>
    [product.name, product.origin, product.bean ?? '', product.process, product.flavor]
      .join(' ')
      .toLocaleLowerCase('zh-TW')
      .includes(needle),
  )
}

export function priceFor(product: Product, size: BagSize): number {
  return size === 'half' ? product.priceHalf : product.priceOne
}

export function getCartTotal(lines: CartLine[], items: Product[] = products): number {
  const byId = new Map(items.map((product) => [product.id, product]))
  return lines.reduce((total, line) => {
    const product = byId.get(line.productId)
    return total + (product ? priceFor(product, line.size) * Math.max(0, line.quantity) : 0)
  }, 0)
}

export function canAddMore(_lines: CartLine[], product: Product, _size: BagSize, _quantity = 1): boolean {
  return product.inventoryStatus !== 'review'
}

# Разбор: Сбер «эксплуатация объектов» + Обнинск (18.07.2026)

## Что ушло на hh

- **Вакансия:** Специалист по эксплуатации объектов (сервис-менеджер) · Сбер для экспертов  
- **id:** `4861aa3a-aa06-41d1-a76a-a1baea0e6b54`  
- **Факт JD:** офис **г. Обнинск**, объекты **недвижимости** банка, разъездной характер, телеметрия/`дистанционный доступ` к объектам — это AHO/facility, не IT L2.

## Почему пропустили (цепочка)

| Слой | Что сломалось |
|------|----------------|
| Роль | В title есть «сервис-менеджер» → `titleLooksSupportRole` = true → лента l2l3 |
| Industrial | `titleLooksIndustrialOrFieldRole` **сразу выходил**, если support=true → facility не ловился |
| Формат | «дистанционного доступа» матчил паттерн `дистанцион` → ложная **удалёнка** |
| Город | «офис по адресу: г. Обнинск» не был explicit office / city |
| Approval | `userApproved: true` на карточке — усилило доверие, но hard-gate всё равно должен был резать |

## Фикс (код)

1. `titleLooksFacilityOpsRole` + `textLooksFacilityOpsBlob` → `off-target-facility`  
2. Facility **до** early-return industrial; support не матчит facility titles  
3. Work-format: strip `дистанционн* доступ`, `офис по адресу`, город Обнинск  
4. Тесты: `test-vacancy-targeting`, `test-vacancy-work-format`

## Что нельзя откатить

Отклик уже на hh; чат работодатель отключил. Дальше — не слать facility/не-Москва офис автоматом.

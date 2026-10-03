"""Realistic seed dataset for dangerous situations and incidents in Kraków.

Categories:
- sexual_assault (próby gwałtu, napaści na tle seksualnym)
- assault (pobicia, agresywne ataki fizyczne)
- harassment (zaczepki słowne, molestowanie, catcalling)
- robbery (rozbój, kradzież zuchwała z zastraszaniem)
- stalking (śledzenie, natarczywe podążanie)
- suspicious (agresywne grupy, wrogie zgromadzenia)
"""

from __future__ import annotations

import contextlib
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from hy.models import INCIDENT_CATEGORY_LABELS, IncidentReport

log = logging.getLogger(__name__)

NOW = datetime.now(UTC)

KRAKOW_SEED_INCIDENTS = [
    # --- HOTSPOT 1: STARE MIASTO / SZEWSKA / FLORIAŃSKA / RYNEK (Very high night traffic, bars, clubs) ---
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.98,
        "lat": 50.0631,
        "lng": 19.9348,
        "title": "Próba wciągnięcia do bramy przy ul. Szewskiej",
        "description": "Nietrzeźwy napastnik złapał dziewczynę za ramię i próbował wciągnąć w bramę kamienicy.",
        "days_ago": 1,
    },
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.95,
        "lat": 50.0636,
        "lng": 19.9352,
        "title": "Napaść seksualna w zaułku przy Szewskiej",
        "description": "Agresywny mężczyzna obmacywał przechodzącą kobietę i groził jej.",
        "days_ago": 3,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.65,
        "lat": 50.0628,
        "lng": 19.9342,
        "title": "Wulgarne zaczepki przed klubem",
        "description": "Grupa mężczyzn wulgarnie nagabywała i szarpała za ubrania przechodzące dziewczyny.",
        "days_ago": 2,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.60,
        "lat": 50.0638,
        "lng": 19.9345,
        "title": "Natarczywe nagabywanie",
        "description": "Zaczepianie, próby zablokowania przejścia, obraźliwe komentarze o podłożu seksualnym.",
        "days_ago": 4,
    },
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.90,
        "lat": 50.0642,
        "lng": 19.9398,
        "title": "Brutalne pobicie na ul. Floriańskiej",
        "description": "Atak trzech mężczyzn na wracającego do domu pieszego.",
        "days_ago": 5,
    },
    {
        "category": "robbery",
        "severity": 2,
        "weight": 0.75,
        "lat": 50.0649,
        "lng": 19.9405,
        "title": "Kradzież zuchwała przy Bramie Floriańskiej",
        "description": "Wyrwanie torebki i telefonu z użyciem siły i zastraszania.",
        "days_ago": 6,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.58,
        "lat": 50.0645,
        "lng": 19.9372,
        "title": "Zaczepki na ul. Sławkowskiej",
        "description": "Głośna grupa pijanych mężczyzn blokowała chodnik i zaczepiała kobiety.",
        "days_ago": 3,
    },
    {
        "category": "stalking",
        "severity": 2,
        "weight": 0.68,
        "lat": 50.0621,
        "lng": 19.9385,
        "title": "Śledzenie przez Rynek Główny",
        "description": "Mężczyzna w kapturze szedł krok w krok za wracającą studentką przez 15 minut.",
        "days_ago": 2,
    },
    {
        "category": "suspicious",
        "severity": 1,
        "weight": 0.45,
        "lat": 50.0615,
        "lng": 19.9365,
        "title": "Agresywna grupa przy Sukiennicach",
        "description": "Zaczepianie turystów i wykrzykiwanie gróźb.",
        "days_ago": 7,
    },
    # --- HOTSPOT 2: PLANTY KRAKOWSKIE (Ciemne alejki po zmroku) ---
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.97,
        "lat": 50.0655,
        "lng": 19.9432,
        "title": "Próba gwałtu w ciemnej alejce Plant (rejon Teatru Słowackiego)",
        "description": "Zamaskowany napastnik przewrócił kobietę na ławkę w nieoświetlonej części parku.",
        "days_ago": 2,
    },
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.88,
        "lat": 50.0648,
        "lng": 19.9445,
        "title": "Pobicie i rozbój na Plantach",
        "description": "Zastraszenie nożem, żądanie wydania pieniędzy i uderzenie w twarz.",
        "days_ago": 4,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.62,
        "lat": 50.0625,
        "lng": 19.9440,
        "title": "Ekshibicjonista na Plantach (ul. Westerplatte / Sienna)",
        "description": "Mężczyzna obnażający się i wykrzykujący wulgarne hasła do przechodniów.",
        "days_ago": 5,
    },
    {
        "category": "stalking",
        "severity": 2,
        "weight": 0.65,
        "lat": 50.0592,
        "lng": 19.9418,
        "title": "Natarczywe podążanie za samotną kobietą",
        "description": "Mężczyzna szedł za kobietą od Poczty Głównej aż na Planty Dietla.",
        "days_ago": 3,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.55,
        "lat": 50.0560,
        "lng": 19.9380,
        "title": "Agresywne zaczepki pod Wawelem",
        "description": "Nietrzeźwi mężczyźni zaczepiający samotne osoby w nocy.",
        "days_ago": 6,
    },
    # --- HOTSPOT 3: BULWARY WIŚLANE / KŁADKA OJCA BERNATKA (Znane miejsce incydentów) ---
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.99,
        "lat": 50.0482,
        "lng": 19.9481,
        "title": "Brutalna napaść na tle seksualnym przy Kładce Bernatka",
        "description": "Napastnik zaatakował kobietę schodzącą na dolny bulwar w kierunku Podgórza.",
        "days_ago": 1,
    },
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.92,
        "lat": 50.0489,
        "lng": 19.9472,
        "title": "Atak grupy na bulwarach wiślanych",
        "description": "Pobicie pieszego przez grupę agresywnych napastników, ucieczka w stronę Kazimierza.",
        "days_ago": 4,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.64,
        "lat": 50.0495,
        "lng": 19.9455,
        "title": "Molestowanie słowne i szarpanie",
        "description": "Zaczepianie spacerujących dziewczyn, groźby wrzucenia do rzeki.",
        "days_ago": 3,
    },
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.94,
        "lat": 50.0515,
        "lng": 19.9360,
        "title": "Próba napaści pod Mostem Grunwaldzkim",
        "description": "Próba przewrócenia biegaczki w ciemnym przejściu pod mostem.",
        "days_ago": 5,
    },
    {
        "category": "robbery",
        "severity": 2,
        "weight": 0.78,
        "lat": 50.0528,
        "lng": 19.9345,
        "title": "Rozbój przy Bulwarze Czerwieńskim",
        "description": "Wyrwanie torebki i ucieczka hulajnogą elektryczną.",
        "days_ago": 7,
    },
    # --- HOTSPOT 4: DWORZEC GŁÓWNY / TUNEL MAGAZYNOWA / BOSACKA ---
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.96,
        "lat": 50.0682,
        "lng": 19.9498,
        "title": "Próba wciągnięcia w zaułek w Tunelu Magazynowa",
        "description": "Ciemny tunel przy torach kolejowych, napastnik groził nożem i żądał zbliżenia.",
        "days_ago": 2,
    },
    {
        "category": "robbery",
        "severity": 2,
        "weight": 0.82,
        "lat": 50.0691,
        "lng": 19.9512,
        "title": "Napad rabunkowy na ul. Bosackiej (MDA)",
        "description": "Dwaj sprawcy osaczyli podróżną z walizką, kradzież telefonu i portfela.",
        "days_ago": 3,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.65,
        "lat": 50.0675,
        "lng": 19.9472,
        "title": "Natarczywe zaczepki w tunelu pod peronami",
        "description": "Agresywne żądanie pieniędzy, zastraszanie i wulgarne obelgi.",
        "days_ago": 4,
    },
    {
        "category": "stalking",
        "severity": 2,
        "weight": 0.70,
        "lat": 50.0668,
        "lng": 19.9485,
        "title": "Śledzenie od dworca do Ronda Mogilskiego",
        "description": "Podejrzany osobnik szedł za pasażerką nocnego pociągu.",
        "days_ago": 6,
    },
    # --- HOTSPOT 5: KAZIMIERZ / PLAC NOWY / SZEROKA ---
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.93,
        "lat": 50.0518,
        "lng": 19.9452,
        "title": "Próba napaści seksualnej w bramie przy Placu Nowym",
        "description": "Zaciągnięcie do ciemnej klatki schodowej po wyjściu z lokalu.",
        "days_ago": 3,
    },
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.85,
        "lat": 50.0524,
        "lng": 19.9441,
        "title": "Bójka i atak niebezpiecznym narzędziem na ul. Estery",
        "description": "Agresywna bójka pod klubem, ranienie potłuczoną butelką.",
        "days_ago": 5,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.60,
        "lat": 50.0529,
        "lng": 19.9478,
        "title": "Zaczepki przy ul. Szerokiej",
        "description": "Zastraszanie, blokowanie drogi rowerzystce przez nietrzeźwą grupę.",
        "days_ago": 4,
    },
    {
        "category": "stalking",
        "severity": 2,
        "weight": 0.62,
        "lat": 50.0505,
        "lng": 19.9435,
        "title": "Śledzenie na ul. Józefa",
        "description": "Natarczywe zagadywanie i podążanie krok w krok.",
        "days_ago": 7,
    },
    # --- HOTSPOT 6: RONDO MOGILSKIE (Dolna płyta, przejścia podziemne) ---
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.86,
        "lat": 50.0658,
        "lng": 19.9602,
        "title": "Pobicie na dolnym poziomie Ronda Mogilskiego",
        "description": "Atak na oczekującego na tramwaj w godzinach nocnych.",
        "days_ago": 2,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.58,
        "lat": 50.0662,
        "lng": 19.9595,
        "title": "Zaczepki w przejściu podziemnym",
        "description": "Grupa młodzieży zaczepiająca i plująca pod nogi przechodniów.",
        "days_ago": 5,
    },
    {
        "category": "robbery",
        "severity": 2,
        "weight": 0.72,
        "lat": 50.0652,
        "lng": 19.9610,
        "title": "Zuchwała kradzież telefonu na przystanku",
        "description": "Wyrwanie telefonu z ręki i ucieczka schodami w stronę Lubomirskiego.",
        "days_ago": 6,
    },
    # --- HOTSPOT 7: NOWA HUTA / PLAC CENTRALNY / ALEJA RÓŻ ---
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.89,
        "lat": 50.0718,
        "lng": 20.0375,
        "title": "Agresywny atak pseudokibiców w rejonie Placu Centralnego",
        "description": "Bójka z użyciem niebezpiecznych narzędzi, interwencja policji.",
        "days_ago": 3,
    },
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.55,
        "lat": 50.0742,
        "lng": 20.0385,
        "title": "Zaczepki przy Alei Róż",
        "description": "Pijana grupa okupująca ławki, wulgarne odzywki.",
        "days_ago": 6,
    },
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.92,
        "lat": 50.0685,
        "lng": 20.0420,
        "title": "Próba napaści na os. Centrum C",
        "description": "Zaatakowanie wracającej ze szpitala pielęgniarki w nieoświetlonej bramie.",
        "days_ago": 5,
    },
    {
        "category": "robbery",
        "severity": 2,
        "weight": 0.74,
        "lat": 50.0760,
        "lng": 20.0350,
        "title": "Kradzież torebki w Parku Ratuszowym",
        "description": "Sprawca podbiegł od tyłu, powalił kobietę na ziemię i wyrwał torbę.",
        "days_ago": 8,
    },
    # --- HOTSPOT 8: PODGÓRZE / PARK BEDNARSKIEGO ---
    {
        "category": "sexual_assault",
        "severity": 3,
        "weight": 0.95,
        "lat": 50.0435,
        "lng": 19.9530,
        "title": "Napaść seksualna w Parku Bednarskiego",
        "description": "Napastnik wyskoczył z zarośli w bocznej alejce, poszkodowana uciekła na ul. Parkową.",
        "days_ago": 3,
    },
    {
        "category": "stalking",
        "severity": 2,
        "weight": 0.64,
        "lat": 50.0450,
        "lng": 19.9510,
        "title": "Śledzenie po schodach z Krzemionek",
        "description": "Mężczyzna podążał za kobietą od Rynku Podgórskiego w górę schodów.",
        "days_ago": 6,
    },
    # --- HOTSPOT 9: KROWODRZA / MIASTECZKO AGH / REYMONTA ---
    {
        "category": "harassment",
        "severity": 2,
        "weight": 0.52,
        "lat": 50.0672,
        "lng": 19.9075,
        "title": "Natarczywe zaczepki w Miasteczku Studenckim AGH",
        "description": "Molestowanie słowne, naruszanie przestrzeni osobistej przy domach studenckich.",
        "days_ago": 2,
    },
    {
        "category": "assault",
        "severity": 3,
        "weight": 0.82,
        "lat": 50.0645,
        "lng": 19.9130,
        "title": "Bójka na ul. Reymonta",
        "description": "Napad na studenta wracającego z biblioteki.",
        "days_ago": 5,
    },
    {
        "category": "stalking",
        "severity": 2,
        "weight": 0.66,
        "lat": 50.0688,
        "lng": 19.9120,
        "title": "Śledzenie przy Parku Jordana / Reymonta",
        "description": "Kierowca samochodu powoli jechał za pieszą, wołając i proponując podwózkę.",
        "days_ago": 4,
    },
    # --- ADDITIONAL MODERATE / LOWER DENSITY SPOTS (Representing Yellow / less frequent zones) ---
    {
        "category": "harassment",
        "severity": 1,
        "weight": 0.40,
        "lat": 50.0780,
        "lng": 19.9320,
        "title": "Zaczepki przy Nowym Kleparzu",
        "description": "Pijany mężczyzna nagabywał pasażerów czekających na autobus.",
        "days_ago": 8,
    },
    {
        "category": "suspicious",
        "severity": 1,
        "weight": 0.35,
        "lat": 50.0545,
        "lng": 19.9210,
        "title": "Podejrzany osobnik na Dębnikach",
        "description": "Osoba obserwująca domy jednorodzinne i zaczepiająca przechodniów.",
        "days_ago": 9,
    },
    {
        "category": "harassment",
        "severity": 1,
        "weight": 0.38,
        "lat": 50.0850,
        "lng": 19.9450,
        "title": "Zaczepki na Prądniku Czerwonym",
        "description": "Pojedyncza sytuacja zaczepiania przy pawilonach handlowych.",
        "days_ago": 10,
    },
    {
        "category": "suspicious",
        "severity": 1,
        "weight": 0.32,
        "lat": 50.0280,
        "lng": 19.9650,
        "title": "Hałaśliwa grupa w Borku Fałęckim",
        "description": "Agresywne okrzyki pod blokami.",
        "days_ago": 11,
    },
    {
        "category": "harassment",
        "severity": 1,
        "weight": 0.36,
        "lat": 50.0890,
        "lng": 19.9150,
        "title": "Zaczepki na Krowodrzy Górce",
        "description": "Zaczepianie przy pętli tramwajowej.",
        "days_ago": 12,
    },
    {
        "category": "suspicious",
        "severity": 1,
        "weight": 0.30,
        "lat": 50.0380,
        "lng": 19.9920,
        "title": "Grupa zaczepiająca w Płaszowie",
        "description": "Drobny incydent w rejonie zalewu Bagry.",
        "days_ago": 14,
    },
]


def seed_krakow_incidents(session: Session) -> int:
    """Populate incident reports table with Kraków incidents if empty."""
    count = session.execute(select(func.count(IncidentReport.id))).scalar_one()
    if count > 0:
        return 0

    inserted = 0
    for item in KRAKOW_SEED_INCIDENTS:
        days_ago = item.get("days_ago", 3)
        reported_at = NOW - timedelta(days=days_ago, hours=(inserted % 12))
        incident = IncidentReport(
            category=item["category"],
            severity=item["severity"],
            weight=item["weight"],
            lat=item["lat"],
            lng=item["lng"],
            title=item.get("title")
            or INCIDENT_CATEGORY_LABELS.get(item["category"], item["category"]),
            description=item.get("description"),
            reported_at=reported_at,
            created_at=reported_at,
        )
        session.add(incident)
        inserted += 1

    session.flush()
    with contextlib.suppress(Exception):
        session.commit()
    log.info("seeded %d Krakow danger incidents for heatmap", inserted)
    return inserted

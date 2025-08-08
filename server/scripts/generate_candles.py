import os
import pandas as pd

# 1-min raw file
INPUT_FILE = os.path.join("..", "All Contracts.xlsb")
SHEET_NAME  = "Sheet1"
OUTPUT_DIR  = os.path.join("..", "data")

# Define all timeframes you want
# keys are labels, values are pandas-friendly resample strings
TIMEFRAMES = {
    "1":   "1T",
    "15":  "15T",
    "30":  "30T",
    "60":  "1H",
    "240": "4H",
    "720": "12H",
    "1440":"1D",
    "10080":"1W",
}

df = pd.read_excel(INPUT_FILE, sheet_name=SHEET_NAME, engine="pyxlsb")
df["Timestamp"] = pd.to_datetime(
    pd.to_numeric(df["Timestamp"], errors="coerce"),
    origin="1899-12-30", unit="d", errors="coerce"
)
df = df.dropna(subset=["Timestamp"]).set_index("Timestamp")

os.makedirs(OUTPUT_DIR, exist_ok=True)

for label, rule in TIMEFRAMES.items():
    ohlc = df["Sell Premium"].resample(rule).ohlc().dropna()
    fname = f"candles_M{label}.csv"
    path  = os.path.join(OUTPUT_DIR, fname)
    ohlc.to_csv(path, index_label="Time")
    print(f"→ {len(ohlc)} bars saved to {fname}")

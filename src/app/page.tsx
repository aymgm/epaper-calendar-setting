'use client'
import { useEffect, useState, useRef } from "react";
import { ThemeProvider, createTheme, styled } from '@mui/material/styles';
import { Container, Button, Stack, Slider, Grid2 as Grid, Tabs, Tab, Box, Backdrop, Switch, FormGroup, FormControlLabel, FormControl, InputLabel, Select, MenuItem, Typography} from "@mui/material";
import { Bluetooth, Send, Collections } from '@mui/icons-material';
import { SimpleBluetooth } from "./SimpleBluetooth";
import { convertToGrayscale, RGBA32Image, DitherParam, binarizeWithDither, AdjustmentParams } from "./BinaryImage";
import Manual from '@/app/mdx-page/manual.mdx'
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const SierraLightDither: DitherParam = {
  denominator: 8,
  elements: [
    { dx: 1, dy: 0, magnitude: 1 },
    { dx: 2, dy: 0, magnitude: 1 },
    { dx: -1, dy: 1, magnitude: 1 },
    { dx: 0, dy: 1, magnitude: 1 },
    { dx: 1, dy: 1, magnitude: 1 },
    { dx: 0, dy: 2, magnitude: 1 }
  ]
}

export default function Home() {
  //const [output, setOutput] = useState<string>("");
  //const [command, setCommand] = useState<string>("");
  const [bt] = useState<SimpleBluetooth>(new SimpleBluetooth());
  const [tabPosition, setTabPosition] = useState(0);
  const [isBtConnected, setIsBtConnected] = useState(false);
  const [isBtConnecting, setIsBtConnecting] = useState(false);
  const [pictureId, setPictureId] = useState(0);
  const [pictureUrl, setPictureUrl] = useState("");
  const [pictureGamma, setPictureGamma] = useState(0.8);
  const [pictureBlack, setPictureBlack] = useState(69);
  const [pictureWhite, setPictureWhite] = useState(160);
  const [isMondayFirst, setIsMondayFirst] = useState(true);
  const [isPictSending, setIsPictSending] = useState(false);
  const [isConfSending, setIsConfSending] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    redrawImage();
  })
  const handleTabPositionChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabPosition(newValue);
  };

  const startConnection = async () => {
    setIsBtConnecting(true)
    try {
      await bt.connect({
        deviceName: 'e-paper calendar',
        onReceived: (str: string) => console.log(str)
      });
    } catch(e) {
      console.log(e);
      return
    } finally {
      setIsBtConnecting(false);
    }
    setIsBtConnected(true);
  }

  const theme = createTheme({
    colorSchemes: {
      light: true,
      dark: true,
    }
  });

  interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
  }
  
  function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
      </div>
    );
  }
  
  function a11yProps(index: number) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }
  

  // const drawPlainText = (ctx: CanvasRenderingContext2D, str: string, x: number, y: number, w: number, h: number) => {
  //   ctx.fillStyle = "#fff";
  //   ctx.fillRect(0, 0, w, h);
  //   ctx.fillStyle = "#000";
  //   ctx.font = "16px monospace"
  //   ctx.fillText(str, 1, 64, w);
  // }

  // const drawText = (str: string): string => {
  //   const WIDTH = 296;
  //   const HEIGHT = 128;
  //   const ctx = canvasRef.current?.getContext('2d');
  //   if (ctx == null) {
  //     throw new Error("failed to get canvas");
  //   }
  //   drawPlainText(ctx, str, 1, 64, WIDTH, HEIGHT);
  //   const img = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  //   const dst = ctx.createImageData(WIDTH, HEIGHT);
  //   convertToGrayscale(img, dst);
  //   const dst2 = new RGBA32Image(WIDTH, HEIGHT);
  //   adaptiveBinarize(dst, dst2);
  //   ctx.putImageData(dst2.toImageData(), 0, 0);

  //   return ctx.canvas.toDataURL("image/png").split(",")[1]
  // }

  const drawImage = async (url: string, adjustmentParams: AdjustmentParams = {gamma: 1.0, black: 0, white: 255}) => {
    const WIDTH = 296;
    const HEIGHT = 128;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx == null) {
      return
    }

    const img = new Image();
    img.src = url;
    await new Promise((resolve) => {
      img.addEventListener('load', (...args) => resolve(...args));
    });

    const magnitude = WIDTH / img.width;
    const virtualHeight = img.height * magnitude;
    const verticalOffset = HEIGHT - virtualHeight;
    if(verticalOffset < 0) {
      ctx.drawImage(img, 0, verticalOffset / (-2 * magnitude), img.width, img.height + (verticalOffset / magnitude), 0, 0, WIDTH, HEIGHT);
    } else {
      ctx.drawImage(img, 0, verticalOffset, WIDTH, HEIGHT - 2 * verticalOffset);
    }
    
    const dst = ctx.createImageData(WIDTH, HEIGHT);
    convertToGrayscale(ctx.getImageData(0, 0, WIDTH, HEIGHT), dst, adjustmentParams);
    const dst2 = new RGBA32Image(WIDTH, HEIGHT);
    binarizeWithDither(dst, dst2, SierraLightDither);
    ctx.putImageData(dst2.toImageData(), 0, 0);
  }

  const redrawImage = async () => {
    if(pictureUrl.length != 0) {
      console.log("redrawing");
      await drawImage(pictureUrl, {gamma: pictureGamma, black: pictureBlack, white: pictureWhite});
      console.log("redrawed");
    }
  }

  const getImageData = async (): Promise<string> => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx == null) {
      throw new Error("failed to get canvas");
    }
    return ctx.canvas.toDataURL("img/png").split(",")[1];
  }

  return (
    <ThemeProvider theme={theme}>
      <Backdrop
        sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
        open={!isBtConnected}
      >
        <Button
          variant="contained"
          aria-label="conect"
          onClick={startConnection}
          size="large"
          startIcon={<Bluetooth />}
          loading={isBtConnecting}
        >
          接続
        </Button>
      </Backdrop>
      <Container maxWidth="md" component="main">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabPosition} onChange={handleTabPositionChange} aria-label="function tab" variant="fullWidth">
            <Tab label="マニュアル" {...a11yProps(0)} />
            <Tab label="画像送信" {...a11yProps(1)} />
            <Tab label="設定" {...a11yProps(2)} />
          </Tabs>
        </Box>
        <CustomTabPanel value={tabPosition} index={0}>
          <Box className="prose dark:prose-invert max-w-none">
            <Manual />
          </Box>
        </CustomTabPanel>
        <CustomTabPanel value={tabPosition} index={1}>
          <Stack sx={{ marginTop: '10px' }} spacing={2}>

            <canvas ref={canvasRef} id="canvas" width={296} height={128} style={{border: 1, borderColor: 'divider'}}></canvas>
            <Grid container spacing={2} sx={{ justifyContent: "space-around", alignItems: "center"}}>
              <Grid size="grow">
                <FormControl fullWidth>
                  <InputLabel id="picture-id-select-label">画像ID</InputLabel>
                  <Select
                    labelId="picture-id-select-label"
                    id="picture-id-select"
                    value={pictureId}
                    label="画像ID"
                    onChange={async e=>{
                      setPictureId(e.target.value as number);
                      await redrawImage();
                    }}
                    size="small"
                  >
                    <MenuItem value={0}>0</MenuItem>
                    <MenuItem value={1}>1</MenuItem>
                    <MenuItem value={2}>2</MenuItem>
                    <MenuItem value={3}>3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size="auto">
                <FormControl >
                  <Button
                    component="label"
                    role={undefined}
                    variant="contained"
                    tabIndex={-1}
                    startIcon={<Collections />}
                    size="medium"
                  >
                    選択
                    <VisuallyHiddenInput
                      type="file"
                      onChange={async (event) => {
                        const f = event.target.files?.item(0);
                        if (f == null) return;
                        const reader = new FileReader();
                        reader.readAsDataURL(f);
                        reader.onload = async () => {
                          const url = reader.result;
                          if (typeof url === "string") {
                            setPictureUrl(url);
                            await redrawImage();
                          }
                        }
                      }}
                      accept="image/*"
                    />
                  </Button>
                </FormControl>
              </Grid>

            </Grid>
            <Grid container direction="row" spacing={2}>
              <Grid size="auto"><Typography gutterBottom>ガンマ値</Typography></Grid>
              <Grid size="grow">
                <Slider
                  value={typeof pictureGamma === 'number' ? pictureGamma : 0.8}
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={ async (_: Event, newValue: number | number[]) => {
                    setPictureGamma(newValue as number);
                    await redrawImage();
                  } }
                />
              </Grid>
            </Grid>
            <Grid container direction="row" spacing={2}>
              <Grid size="auto"><Typography gutterBottom>黒の最大値</Typography></Grid>
              <Grid size="grow">
                <Slider
                  value={typeof pictureBlack === 'number' ? pictureBlack : 64}
                  min={0}
                  max={255}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={ async (_: Event, newValue: number | number[]) => {
                    setPictureBlack(newValue as number);
                    await redrawImage();
                  } }
                />
              </Grid>
            </Grid>
            <Grid container direction="row" spacing={2}>
              <Grid size="auto"><Typography gutterBottom>白の最小値</Typography></Grid>
              <Grid size="grow">
                <Slider
                  value={typeof pictureWhite === 'number' ? pictureWhite : 160}
                  min={0}
                  max={255}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={ async (_: Event, newValue: number | number[]) => {
                    setPictureWhite(newValue as number);
                    await redrawImage();
                  }}
                />
              </Grid>
            </Grid>
            <FormControl>
              <Button
                variant="contained"
                startIcon={<Send />}
                size="medium"
                onClick={ async () => {
                  setIsPictSending(true);
                  const dat = await getImageData();
                  await bt.sendString(JSON.stringify({"typ": "pic", "idx": pictureId, "dat": dat}));
                  setIsPictSending(false);
                  await redrawImage();
                }}
                loading={isPictSending}
              >
                送信
              </Button>
            </FormControl>
            {/*
            <Divider />
            <TextField label="Output" multiline rows={2} value={output}/>
            */}
          </Stack>
        </CustomTabPanel>

        <CustomTabPanel value={tabPosition} index={2}>
          <Stack spacing={4}>
            <FormGroup>
              <FormControlLabel control={
                <Switch checked={isMondayFirst} onChange={e=>{
                  setIsMondayFirst(e.target.checked)
                }}/>
              } label="月曜始まり" />
            </FormGroup>

            <FormControl>
              <Button
                variant="contained"
                startIcon={<Send />}
                size="medium"
                onClick={ async () => {
                  setIsConfSending(true);
                  await bt.sendString(JSON.stringify({"typ": "cal", "imf": isMondayFirst}));
                  setIsConfSending(false);
                }}
                loading={isConfSending}
              >
                送信
              </Button>
            </FormControl>
          </Stack>
        </CustomTabPanel>
      </Container>
    </ThemeProvider>
  );
}

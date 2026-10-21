import {useMemo} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogActions,DialogContent,DialogTitle,List,ListItem,Table,TableBody,TableCell,TableHead,TableRow,Typography,useMediaQuery,useTheme} from '@mui/material';
import {buildSelectionReasons} from './selectionReasons';
export default function SelectionReasonDialog({row,onClose,onOpenChart,context}){
 const mobile=useMediaQuery(useTheme().breakpoints.down('sm'));
 const info=useMemo(()=>row?buildSelectionReasons(row,context):null,[row,context]);
 if(!info)return null;
 return <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={mobile} aria-labelledby="selection-reason-title">
  <DialogTitle id="selection-reason-title">{info.symbol} · 为什么出现在结果里？<Typography variant="body2" color="text.secondary">{info.company} · 日线截至 {info.asOfDate||'未提供'} · 规则说明，无大模型调用</Typography></DialogTitle>
  <DialogContent dividers>
   <Alert severity={info.matched?'info':'warning'}>{info.matched?`${info.screenName}：${info.hasConditions?'满足当前启用的筛选逻辑。':'未设置额外条件，属于全列表展示。'}`:'已不满足当前筛选，请关闭详情并检查更新后的列表。'}{info.rank?` 当前排名 ${info.rank}，按${info.sortLabel}${info.sortOrder}排序。`:''} 排名靠前不表示通过所有模型。</Alert>
   <Typography component="h2" variant="h6" sx={{mt:2}}>当前筛选的实际证据</Typography>
   {info.groups.filter(g=>g.conditions.length).map(g=><Box key={g.id} sx={{my:1,p:1,border:'1px solid',borderColor:'divider',borderRadius:1}}>
    <Typography>{g.name} · {g.match==='any'?'至少一项':'全部'}满足 · {g.passed?'通过':'未通过'}</Typography>
    <List dense>{g.conditions.map((c,i)=><ListItem key={i} sx={{gap:1,alignItems:'flex-start'}}><Chip label={c.passed?'满足':'未满足'} size="small" color={c.passed?'success':'default'}/><Typography variant="body2">{c.label} {c.rule}；实际 {c.actual}</Typography></ListItem>)}</List>
   </Box>)}
   {info.groups.length>1&&<Typography variant="body2">逻辑组之间要求：{info.groupJoin==='all'?'全部组通过':'至少一组通过'}；“必须满足的条件”另行全部要求。</Typography>}
   {!info.hasConditions&&<Typography>没有把“高分”隐含当作筛选门槛。</Typography>}
   <Typography component="h2" variant="h6" sx={{mt:2}}>值得关注的特征</Typography>
   <List dense>{(info.strengths.length?info.strengths:['当前快照没有足够字段生成更多特征说明。']).map(t=><ListItem key={t}>• {t}</ListItem>)}</List>
   <Typography component="h2" variant="h6">评分拆分 · 综合分 {info.composite==null?'未提供':info.composite.toFixed(1)}</Typography>
   <Table size="small" aria-label="模型原始得分"><TableHead><TableRow><TableCell>参与模型</TableCell><TableCell align="right">原始分 / 100</TableCell></TableRow></TableHead><TableBody>{info.models.map(m=><TableRow key={m.id}><TableCell>{m.name}</TableCell><TableCell align="right" sx={{fontVariantNumeric:'tabular-nums'}}>{m.score==null?'未提供':m.score.toFixed(1)}</TableCell></TableRow>)}</TableBody></Table>
   <Typography variant="body2" color="text.secondary" sx={{mt:1}}>分数来自原日线快照，不是上涨概率。本面板不推测各指标的加减分，也不重算评分。券商补查结果另列；快照日期不代表每项基本面的报告日期。</Typography>
   <Typography component="h2" variant="h6" sx={{mt:2}}>尚未满足与风险</Typography>
   <List dense>{(info.cautions.length?info.cautions:['当前字段未提供额外风险说明，不代表没有风险。']).map(t=><ListItem key={t}>• {t}</ListItem>)}</List>
   {info.missing.length>0&&<Alert severity="warning">原评分快照缺少：{info.missing.map(m=>m.label).join('、')}。未提供的数值不会当作零；详情不推断它们对原评分的具体影响。</Alert>}
  </DialogContent>
  <DialogActions sx={{p:1.5}}>{onOpenChart&&<Button onClick={()=>onOpenChart(row.symbol)} sx={{minHeight:44}}>查看日线图表</Button>}<Button onClick={onClose} variant="contained" sx={{minHeight:44}}>关闭说明</Button></DialogActions>
 </Dialog>
}

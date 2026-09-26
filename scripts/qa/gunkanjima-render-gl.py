# Replays real shader and draw calls on surfaceless EGL/GLES2; requires Pillow and Mesa EGL.
import ctypes as C,json,base64,pathlib,sys
output=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else "/tmp/jta-gl-qa")
from PIL import Image
P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float;B=C.c_ubyte;S=C.c_char_p
E=C.CDLL('libEGL.so.1');E.eglGetProcAddress.argtypes=[S];E.eglGetProcAddress.restype=P
get=C.CFUNCTYPE(P,U,P,C.POINTER(I))(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'));display=get(0x31dd,None,None)
def egl(name,ret,types,*args):
 f=getattr(E,name);f.restype=ret;f.argtypes=types;return f(*args)
a,b=I(),I();assert egl('eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)],display,C.byref(a),C.byref(b))
attrs=(I*15)(0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3033,1,0x3040,4,0x3038);cfg=P();n=I();assert egl('eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)],display,attrs,C.byref(cfg),1,C.byref(n))
egl('eglBindAPI',U,[U],0x30a0)
surface=egl('eglCreatePbufferSurface',P,[P,P,C.POINTER(I)],display,cfg,(I*5)(0x3057,1280,0x3056,800,0x3038));context=egl('eglCreateContext',P,[P,P,P,C.POINTER(I)],display,cfg,None,(I*3)(0x3098,2,0x3038));assert egl('eglMakeCurrent',U,[P,P,P,P],display,surface,surface,context)
cache={}
def gl(name,ret,types,*args):
 if name not in cache:cache[name]=C.CFUNCTYPE(ret,*types)(E.eglGetProcAddress(name.encode()))
 return cache[name](*args)
print('Renderer',gl('glGetString',S,[U],0x1f01).decode())
refs={};held=[];flip=False
for name,args,result in json.load(open(output/'gl-calls.json')):
 def value(x):
  if isinstance(x,dict) and 'ref' in x:return refs[x['ref']]
  if isinstance(x,dict) and 'typed' in x:
   v=C.create_string_buffer(base64.b64decode(x['data']));held.append(v);return C.cast(v,P)
  return x
 v=[value(x) for x in args];out=None
 if name=='capture':
  gl('glFinish',None,[]);data=(B*(1280*800*4))();gl('glReadPixels',None,[I,I,I,I,U,U,P],0,0,1280,800,6408,5121,data);Image.frombytes('RGBA',(1280,800),bytes(data)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(output/(v[0]+'.png'));print('Saved',v[0]);continue
 if name in ['createBuffer','createTexture','createFramebuffer']:
  o=U();gl({'createBuffer':'glGenBuffers','createTexture':'glGenTextures','createFramebuffer':'glGenFramebuffers'}[name],None,[I,C.POINTER(U)],1,C.byref(o));out=o.value
 elif name=='createShader':out=gl('glCreateShader',U,[U],v[0])
 elif name=='createProgram':out=gl('glCreateProgram',U,[])
 elif name=='shaderSource':
  source=S(v[1].encode());gl('glShaderSource',None,[U,I,C.POINTER(S),P],v[0],1,C.byref(source),None)
 elif name=='compileShader':
  gl('glCompileShader',None,[U],v[0]);ok=I();gl('glGetShaderiv',None,[U,U,C.POINTER(I)],v[0],35713,C.byref(ok));
  if not ok.value:
   log=C.create_string_buffer(8192);gl('glGetShaderInfoLog',None,[U,I,P,P],v[0],8192,None,log);raise RuntimeError(log.value.decode())
 elif name=='linkProgram':
  gl('glLinkProgram',None,[U],v[0]);ok=I();gl('glGetProgramiv',None,[U,U,C.POINTER(I)],v[0],35714,C.byref(ok));
  if not ok.value:
   log=C.create_string_buffer(8192);gl('glGetProgramInfoLog',None,[U,I,P,P],v[0],8192,None,log);raise RuntimeError(log.value.decode())
 elif name=='getUniformLocation':out=gl('glGetUniformLocation',I,[U,S],v[0],v[1].encode())
 elif name=='bindAttribLocation':gl('glBindAttribLocation',None,[U,U,S],v[0],v[1],v[2].encode())
 elif name=='bufferData':gl('glBufferData',None,[U,C.c_ssize_t,P,U],v[0],len(base64.b64decode(args[1]['data'])),v[1],v[2])
 elif name=='texImage2D':
  im=Image.open(v[5]['image']).convert('RGB');im=im.transpose(Image.Transpose.FLIP_TOP_BOTTOM) if flip else im;buf=C.create_string_buffer(im.tobytes());gl('glTexImage2D',None,[U,I,I,I,I,I,U,U,P],v[0],v[1],6407,im.width,im.height,0,6407,5121,buf)
 elif name=='pixelStorei':
  if v[0]==37440:flip=bool(v[1])
 elif name=='uniformMatrix4fv':gl('glUniformMatrix4fv',None,[I,I,B,P],v[0],1,v[1],v[2])
 elif name in ['uniform2fv','uniform3fv','uniform4fv']:
  arr=(F*len(v[1]))(*v[1]) if isinstance(v[1],list) else v[1];gl('gl'+name[0].upper()+name[1:],None,[I,I,P],v[0],1,arr)
 elif name=='deleteBuffer':
  o=U(v[0]);gl('glDeleteBuffers',None,[I,C.POINTER(U)],1,C.byref(o))
 else:
  signatures={'attachShader':[U,U],'bindBuffer':[U,U],'useProgram':[U],'enableVertexAttribArray':[U],'disableVertexAttribArray':[U],'vertexAttribPointer':[U,I,U,B,I,P],'bindTexture':[U,U],'activeTexture':[U],'generateMipmap':[U],'texParameteri':[U,U,I],'uniform1i':[I,I],'uniform1f':[I,F],'uniform2f':[I,F,F],'viewport':[I,I,I,I],'clearColor':[F,F,F,F],'clear':[U],'enable':[U],'disable':[U],'cullFace':[U],'blendFunc':[U,U],'depthMask':[B],'drawElements':[U,I,U,P],'drawArrays':[U,I,I],'bindFramebuffer':[U,U]}
  if name not in signatures:raise RuntimeError('Unknown '+name)
  sig=signatures[name];v=[0 if x is None and t in (U,I) else x for x,t in zip(v,sig)];gl('gl'+name[0].upper()+name[1:],None,sig,*v)
 if result is not None:refs[result['ref']]=out
 error=gl('glGetError',U,[])
 if error:raise RuntimeError(name+' error '+hex(error))
print('All shaders compiled, linked and rendered without GL errors.')
